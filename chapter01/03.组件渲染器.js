// 组件是什么？组件就是一组 DOM 的封装
// 我们可以将组件看成一个函数，返回了一个 vnode
// 我们也可以将组件看成一个对象，描述了一个 vnode
const MyComponent = function () {
  return {
    tag: 'div',
    props: {
      onClick: () => alert('hello'),
    },
    children: 'click me',
  }
}

const vnode = {
  tag: MyComponent,
}

function renderer(vnode, container) {
  const { tag } = vnode
  if (typeof tag === 'string') {
    mountElement(vnode, container) // 使用02中的简易渲染器
  } else if (typeof tag === 'function') {
    mountComponentElement(vnode, container)
  }
}

function mountComponentElement(vnode, container) {
  const subtree = vnode.tag() // 获取组件中实际上要渲染的内容
  mountElement(subtree ,container)
}


renderer(vnode, document.body)