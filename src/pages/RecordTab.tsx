export function RecordTab() {
  return (
    <section className="pad">
      <textarea
        className="ta"
        placeholder={'쓴 만큼 한 줄씩 적으세요.\n\n훠궈 380\n택시 45 소영\n마사지 198 혜연\n숙소 240000원'}
      />
      <div className="row2" style={{ marginTop: 10 }}>
        <button className="btn quiet" style={{ flex: '0 0 32%' }}>지우기</button>
        <button className="btn">읽어들이기</button>
      </div>
      <p className="note" style={{ marginTop: 9 }}>
        이름을 안 적으면 <b>공금</b>, 참여자 이름을 적으면 그 사람 개인 결제로 들어가요.
        숫자만 적으면 위안, <b>원</b>을 붙이면 원화로 읽어요.
      </p>
    </section>
  )
}
