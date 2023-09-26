import parse from './02.构建AST.js'
import dump from './utils/dump.js'

function transformElement(node) {
  let { type, tag } = node
  if (type === 'Element' && tag === 'p') {
    node.tag = 'h1'
  }
}

function transformText(node, context) {
  let { type } = node
  if (type === 'Text') {
    // context.removeNode()
    context.replaceNode({
      type: 'Element',
      tag: 'span',
    })
  }
}

function traverseNode(ast, context) {
  context.currentNode = ast
  const children = context.currentNode.children
  const { nodeTransforms } = context
  const exitFns = []

  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](context.currentNode, context)
    if (onExit) {
      exitFns.push(onExit)
    }

    if (!context.currentNode) return // 处理当前节点被删除的情况，被删除了也不需要处理后面的子了
  }

  if (children && children.length) {
    context.parent = context.currentNode
    for (let i = 0; i < children.length; i++) {
      context.childIndex = i
      traverseNode(children[i], context)
    }
  }

  let len = exitFns.length
  while (len--) {
    exitFns[len]()
  }
}

function transform(ast) {
  const context = {
    nodeTransforms: [transformElement, transformText],
    currentNode: null,
    parent: null,
    childIndex: 0,
    stack: [],
    replaceNode(node) {
      context.parent.children[context.childIndex] = node
      context.currentNode = node
    },
    removeNode() {
      context.parent.children.splice(context.childIndex, 1)
      context.currentNode = null
    },
  }
  traverseNode(ast, context)
  dump(ast)
}

// const ast = parse('<div><p>hello</p><p>world</p></div>')
// transform(ast)

class Chain {
  constructor(fn) {
    this.fn = fn
    this.successor = null
  }

  setNextSuccessor(successor) {
    return (this.successor = successor)
  }

  passRequest(...args) {
    const result = this.fn.apply(this, args)
    if (result === 'next') {
      return this.successor && this.successor.passRequest.apply(this.successor, args)
    }
    return result
  }
}

const validEqual1 = (p) => {
  if (p === 1) {
    console.log('success1')
    return
  }
  return 'next'
}

const validEqual2 = (p) => {
  if (p === 2) {
    console.log('success2')
    return
  }
  return 'next'
}

const c1 = new Chain(validEqual1)
const c2 = new Chain(validEqual2)
c1.setNextSuccessor(c2)
c1.passRequest(2)