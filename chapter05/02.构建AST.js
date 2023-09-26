import tokenize from './01.编译器parser的实现.js'
// import dump from './utils/dump.js'

function parse(str) {
  const tokens = tokenize(str)
  const root = {
    type: 'Root',
    children: [],
  }
  const elementStack = [root]
  for (let token of tokens) {
    const parent = elementStack[elementStack.length - 1]
    const { type, name, content } = token
    switch (type) {
      case 'tag':
        const elementNode = {
          type: 'Element',
          tag: name,
          children: [],
        }
        parent.children.push(elementNode)
        elementStack.push(elementNode) // 当前标签放入栈顶
        break
      case 'text':
        const textNode = {
          type: 'Text',
          content,
        }
        parent.children.push(textNode)
        break
      case 'tagEnd':
        elementStack.pop()
        break
    }
  }
  return root
}

const ast = parse('<div><p>hello</p><p>world</p></div>')
// dump(ast)

export default parse

