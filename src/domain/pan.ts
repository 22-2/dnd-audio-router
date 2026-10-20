// 左右（パン）の値を、画面に出す文字に変える。
// 値は -100（左端）から 100（右端）、0 が中央。

export function formatPan(pan: number): string {
  if (pan === 0) {
    return "中央";
  }
  const side = pan < 0 ? "左" : "右";
  return `${side}${Math.abs(pan)}`;
}
