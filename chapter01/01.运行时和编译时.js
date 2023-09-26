const obj = {
  tag: 'div',
  children: [
    {tag: 'span', children: 'hello world'}
  ]
}

function render(obj, root) {
  const { tag, children } = obj
  const el = document.createElement(tag)
  if (typeof children === 'string') {
    const textNode = document.createTextNode(children)
    el.appendChild(textNode)
  } else {
    children.forEach(item => {
      render(item, el)
    });
  }

  root.appendChild(el)
}