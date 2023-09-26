/**
 * 
 * 展示 AST 信息 ep: <div><p>hello</p><p>world</p></div>
Root: 
--Element: div
----Element: p
------Text: hello
----Element: p
------Text: world
 */
function dump(node, indent = 0) {
  const { type, tag, content, children } = node
  const desc = type === 'Root' ? '' : type === 'Element' ? tag : content

  console.log(`${'-'.repeat(indent)}${type}: ${desc}`)

  if (children && children.length) {
    children.forEach((n) => dump(n, indent + 2))
  }
}

export default dump