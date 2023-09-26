const state = {
  initial: 1, // 初始状态
  tagOpen: 2, // 标签开始状态
  tagName: 3, // 标签名称状态
  text: 4, // 文本状态
  tagEnd: 5, // 标签结束状态
  tagEndName: 6, // 结束标签名状态
}

// 判断是普通字母
function isAlpha(char) {
  return (char > 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

function tokenize(str) {
  let currentState = state.initial
  let tokens = []
  const chars = [] // 缓存文本字符
  while (str) {
    const char = str[0]
    // 暂时不处理语法错误的情况，比如是标签开始状态还又读到'<'，说明有语法错误
    switch (currentState) {
      case state.initial:
        // 初始状态要么是读到标签开始，要么是读到字符
        if (char === '<') {
          currentState = state.tagOpen
          str = str.slice(1)
        } else if (isAlpha(char)) {
          currentState = state.text
          chars.push(char)
          str = str.slice(1)
        }
        break
      case state.tagOpen:
        // 标签开始状态要么是读到字母变成标签名称状态，要么是读到"/"变成标签结束状态
        if (isAlpha(char)) {
          currentState = state.tagName
          chars.push(char)
          str = str.slice(1)
        } else if (char === '/') {
          currentState = state.tagEnd
          str = str.slice(1)
        }
        break
      case state.tagName:
        // 标签名状态要么是读到字母还是标签名，要么是读到">"标签结束，重置状态
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if (char === '>') {
          currentState = state.initial
          tokens.push({ type: 'tag', name: chars.join('') })
          str = str.slice(1)
          chars.length = 0
        }
        break
      case state.text:
        // 文本状态下要么继续读到字母，要么读到"<"就是标签开始状态
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if (char === '<') {
          currentState = state.tagOpen
          tokens.push({
            type: 'text',
            content: chars.join(''),
          })
          chars.length = 0
          str = str.slice(1)
        }
        break
      case state.tagEnd:
        // 标签结束状态只能读到字母进入结束标签名称状态
        if (isAlpha(char)) {
          currentState = state.tagEndName
          chars.push(char)
          str = str.slice(1)
        }
        break
      case state.tagEndName:
        // 结束标签名状态要么读取到字母还是标签名，要么读取到">"重置状态，读取结束
        if (isAlpha(char)) {
          chars.push(char)
          str = str.slice(1)
        } else if (char === '>') {
          currentState = state.initial
          tokens.push(
            {type: 'tagEnd', name: chars.join('')}
          )
          chars.length = 0
          str = str.slice(1)
        }
        break
    }
  }
  return tokens
}

export default tokenize