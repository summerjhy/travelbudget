import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trip-code',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * CODEF 카드 승인내역 연동 (관리자 본인 카드 전용).
 *
 * 클라이언트에는 CODEF 자격증명도 connectedId 도 절대 내보내지 않는다.
 * 브라우저는 "등록해줘 / 불러와줘" 만 요청하고 결과 목록만 받는다.
 *
 * 카드사 로그인 비밀번호는 저장하지 않는다. 등록할 때 CODEF 공개키로
 * 암호화해 한 번 보내고, 돌려받은 connectedId 만 DB 에 둔다.
 */

const CODEF_OAUTH = 'https://oauth.codef.io/oauth/token'
const CODEF_API = 'https://api.codef.io'

interface Body {
  adminPassword: string
  action: 'status' | 'link' | 'unlink' | 'fetch'
  // link
  label?: string
  organization?: string
  loginType?: string
  id?: string
  password?: string
  birthDate?: string
  // fetch
  linkId?: string
  startDate?: string
  endDate?: string
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/** CODEF 응답은 URL 인코딩된 JSON 으로 온다. */
async function readCodef(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(decodeURIComponent(text))
  } catch {
    try {
      return JSON.parse(text)
    } catch {
      return { _raw: text.slice(0, 400) }
    }
  }
}

async function getToken(): Promise<string | null> {
  const id = Deno.env.get('CODEF_CLIENT_ID')
  const secret = Deno.env.get('CODEF_CLIENT_SECRET')
  if (!id || !secret) return null

  const basic = btoa(`${id}:${secret}`)
  const res = await fetch(CODEF_OAUTH, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=read',
  })
  if (!res.ok) {
    console.error('CODEF 토큰 발급 실패', res.status, (await res.text()).slice(0, 200))
    return null
  }
  const data = await res.json()
  return data.access_token ?? null
}

async function callCodef(path: string, token: string, payload: unknown) {
  const res = await fetch(`${CODEF_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { status: res.status, body: await readCodef(res) }
}

/**
 * CODEF 공개키로 비밀번호를 암호화한다.
 *
 * CODEF 는 PKCS#1 v1.5 패딩을 쓴다 (공식 SDK 가 RSA_PKCS1_PADDING 사용).
 * WebCrypto 는 OAEP 만 지원해서 쓸 수 없으므로 Deno 의 node:crypto 호환
 * 레이어를 쓴다. OAEP 로 보내면 CODEF 가 복호화하지 못한다.
 */
async function encryptPassword(plain: string): Promise<string | null> {
  const pub = Deno.env.get('CODEF_PUBLIC_KEY')
  if (!pub) return null

  const { publicEncrypt, constants } = await import('node:crypto')
  const b64 = pub.replace(/\s+/g, '')
  const pem = ['-----BEGIN PUBLIC KEY-----', b64, '-----END PUBLIC KEY-----'].join('\n')
  const buf = publicEncrypt(
    { key: pem, padding: constants.RSA_PKCS1_PADDING },
    new TextEncoder().encode(plain),
  )
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, 400)
  }

  const adminPassword = Deno.env.get('ADMIN_PASSWORD')
  if (!adminPassword) return json({ error: '서버에 관리자 비밀번호가 설정되지 않았습니다.' }, 500)
  if (body.adminPassword !== adminPassword) {
    return json({ error: '관리자 비밀번호가 올바르지 않습니다.' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ---------- 연동 상태 (connectedId 는 절대 내보내지 않는다) ----------
  if (body.action === 'status') {
    const { data } = await supabase
      .from('card_links')
      .select('id, label, organization, created_at')
      .order('created_at', { ascending: false })
    return json({ links: data ?? [], configured: !!Deno.env.get('CODEF_CLIENT_ID') }, 200)
  }

  // ---------- 카드 연동 해제 ----------
  if (body.action === 'unlink') {
    if (!body.linkId) return json({ error: '어떤 카드인지 지정해주세요.' }, 400)
    const { error } = await supabase.from('card_links').delete().eq('id', body.linkId)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true }, 200)
  }

  const token = await getToken()
  if (!token) {
    return json({ error: 'CODEF 자격증명이 설정되지 않았거나 토큰 발급에 실패했습니다.' }, 500)
  }

  // ---------- 카드사 계정 등록 -> connectedId 발급 ----------
  if (body.action === 'link') {
    if (!body.organization || !body.id || !body.password) {
      return json({ error: '카드사, 아이디, 비밀번호를 모두 입력해주세요.' }, 400)
    }
    const encrypted = await encryptPassword(body.password)
    if (!encrypted) return json({ error: 'CODEF 공개키가 설정되지 않았습니다.' }, 500)

    const { status, body: res } = await callCodef('/v1/account/create', token, {
      accountList: [{
        countryCode: 'KR',
        businessType: 'CD',
        clientType: 'P',
        organization: body.organization,
        loginType: body.loginType ?? '1', // 1 = 아이디 로그인
        id: body.id,
        password: encrypted,
        birthDate: body.birthDate ?? '',
      }],
    })

    const result = res.result as { code?: string; message?: string; extraMessage?: string } | undefined
    const data = res.data as { connectedId?: string } | undefined
    if (status !== 200 || !data?.connectedId) {
      return json({
        error: result?.extraMessage || result?.message || '카드사 계정 등록에 실패했어요.',
        code: result?.code,
      }, 400)
    }

    const { error } = await supabase.from('card_links').insert({
      label: body.label?.trim() || '내 카드',
      organization: body.organization,
      connected_id: data.connectedId,
    })
    if (error) return json({ error: '연동 정보를 저장하지 못했어요.' }, 500)
    return json({ ok: true }, 200)
  }

  // ---------- 승인내역 불러오기 ----------
  if (body.action === 'fetch') {
    if (!body.linkId || !body.startDate || !body.endDate) {
      return json({ error: '카드와 기간을 지정해주세요.' }, 400)
    }
    const { data: link } = await supabase
      .from('card_links')
      .select('organization, connected_id')
      .eq('id', body.linkId)
      .maybeSingle()
    if (!link) return json({ error: '연동된 카드를 찾을 수 없어요.' }, 404)

    const { status, body: res } = await callCodef('/v1/kr/card/p/account/approval-list', token, {
      organization: link.organization,
      connectedId: link.connected_id,
      startDate: body.startDate,
      endDate: body.endDate,
      orderBy: '0',
      inquiryType: '1', // 전체 카드
      memberStoreInfoType: '0',
    })

    const result = res.result as { code?: string; message?: string; extraMessage?: string } | undefined
    if (status !== 200 || (result?.code && result.code !== 'CF-00000')) {
      return json({
        error: result?.extraMessage || result?.message || '승인내역을 불러오지 못했어요.',
        code: result?.code,
      }, 400)
    }

    const raw = res.data
    const list = (Array.isArray(raw) ? raw : []) as Record<string, string>[]

    // 취소·거절건은 지출이 아니므로 걸러낸다. resCancelYN "0" 만 정상 승인이다.
    const approvals = list
      .filter((r) => (r.resCancelYN ?? '0') === '0')
      .map((r) => {
        const currency = (r.resAccountCurrency || 'KRW').toUpperCase()
        const used = Number(r.resUsedAmount || 0)
        const krwField = Number(r.resKRWAmt || 0)
        return {
          approvalNo: r.resApprovalNo || '',
          date: r.resUsedDate || '',
          time: r.resUsedTime || '',
          merchant: r.resMemberStoreName || '지출',
          currency,
          // 원화 결제면 이용금액이 곧 원화다. 해외면 resKRWAmt 를 쓰되,
          // 카드사에 따라 안 내려주는 경우가 있어 0 이면 클라이언트가 환율로 채운다.
          amount: currency === 'KRW' ? 0 : used,
          krw: currency === 'KRW' ? used : krwField,
          foreign: r.resHomeForeignType === '2',
          cardName: r.resCardName || '',
        }
      })
      // 승인번호가 없는 건(NH 해외건 등)은 중복 판정이 불가능해 날짜+가맹점+금액으로 키를 만든다.
      .map((a) => ({
        ...a,
        approvalNo: a.approvalNo || `${a.date}-${a.merchant}-${a.krw || a.amount}`,
      }))

    // 이미 저장된 승인번호는 표시해서 사용자가 중복을 피할 수 있게 한다.
    const { data: existing } = await supabase
      .from('entries')
      .select('approval_no')
      .not('approval_no', 'is', null)
    const seen = new Set((existing ?? []).map((e) => e.approval_no))

    return json({
      approvals: approvals.map((a) => ({ ...a, alreadySaved: seen.has(a.approvalNo) })),
    }, 200)
  }

  return json({ error: '알 수 없는 요청입니다.' }, 400)
})
