const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello'),
  },
  children: 'click me',
}

function renderer(vnode, container) {
  const { tag, props, children } = vnode
  const el = document.createElement(tag)
  for (const key in props) {
    if (/^on/.test(key)) {
      const event = key.substr(2).toLowerCase()
      el.addEventListener(event, props[key])
    }
  }

  if (typeof children === 'string') {
    const text = document.createTextNode(children)
    el.appendChild(text)
  } else {
    children.forEach((item) => {
      renderer(item, el)
    })
  }

  container.appendChild(el)
}
