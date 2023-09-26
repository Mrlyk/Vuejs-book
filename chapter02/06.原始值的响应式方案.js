// 使用 proxy
const ITERATE_KEY = Symbol()
const RAW_KEY = Symbol()

const TRIGGER_TYPE = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE',
}

let activeEffect
let effectStack = []
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn // 最终成为被track的函数是它
    effectStack.push(effectFn)
    const res = fn()

    effectStack.pop() //支持嵌套
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.deps = [] // 保存所有依赖了我的 deps
  effectFn.options = options
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

const jobQueue = new Set()
const p = Promise.resolve()

let isFlushing = false
function flushJob() {
  if (isFlushing) return

  isFlushing = true

  p.then(() => {
    jobQueue.forEach((job) => job())
  }).finally(() => {
    isFlushing = false
  })
}

// 这些方法也要被重写，以处理可能的循环引用导致的问题
let shouldTrack = true
;['push', 'pop', 'splice', 'shift', 'unshift'].forEach((method) => {
  const originMethod = Array.prototype[method]
  shouldTrack[method] = function (...args) {
    shouldTrack = false
    const res = originMethod.apply(this, args)

    shouldTrack = true
    return res
  }
})

const bucket = new WeakMap()

function track(target, key) {
  if (!activeEffect || !shouldTrack) return target[key]

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effects = depsMap.get(key)

  const effectsToRun = new Set()
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })

  if (Array.isArray(target) && type === TRIGGER_TYPE.ADD) {
    const lengthEffects = depsMap.get('length') // 根据 ES 规范 length 会在通过索引设值时自动设置
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn)
        }
      })
  }

  if (Array.isArray(target) && key === 'length') {
    // 超出索引值就会被删，要触发依赖响应
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }

  // 新增和删除都应该触发遍历的依赖
  if (type === TRIGGER_TYPE.ADD || type === TRIGGER_TYPE.DELETE) {
    const iterateEffects = depsMap.get(ITERATE_KEY) // 把迭代时的依赖一起取出来拼在一起
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn)
        }
      })
  }

  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps = []
}

function isNotEqual(newVal, oldVal) {
  const isNotNaN = oldVal === oldVal || newVal === newVal
  return newVal !== oldVal && isNotNaN
}

let arrayInstrumentations = {}
;['includes', 'indexOf', 'lastIndexOf'].forEach((method) => {
  arrayInstrumentations[method] = function (...args) {
    const originMethod = Array.prototype[method]
    let res = originMethod.apply(this, args)

    if (res === false) {
      res = originMethod.apply(this[RAW_KEY], args)
    }
    return res
  }
})

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === RAW_KEY) {
        // 通过 raw 关键字返回原始对象
        return target
      }

      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    // 迭代时没有单独的 key，所以只能单独创建一个独一无二的
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)
      if (hadKey && res) {
        // 只有拥有该属性并且被删除成功时才触发
        trigger(target, key, TRIGGER_TYPE.DELETE)
      }

      return res
    },
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      const oldValue = target[key]

      // 针对数组，如果新的索引大于原有的说明就是增加
      const type = Array.isArray(target)
        ? Number(key) > Number(target.length)
          ? TRIGGER_TYPE.ADD
          : TRIGGER_TYPE.SET
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TRIGGER_TYPE.SET
        : TRIGGER_TYPE.ADD

      const res = Reflect.set(target, key, newVal, receiver)

      if (target === receiver[RAW_KEY]) {
        // 是当前对象而不是原型
        if (isNotEqual(newVal, oldValue)) {
          trigger(target, key, type, newVal)
        }
      }

      return res
    },
  })
}

const reactiveMap = new Map()

function reactive(obj) {
  const existionProxy = reactiveMap.get(obj)
  if (existionProxy) {
    return existionProxy
  }

  const proxy = createReactive(obj)
  reactiveMap.set(obj, proxy)
  return proxy
}

function shallowReactive(obj) {
  return createReactive(obj, true)
}

function readonly(obj) {
  return createReactive(obj, false, true)
}

function shallowReadonly(obj) {
  return createReactive(obj, true, true)
}

function ref(value) {
  const obj = {
    value: value,
  }
  // 标记他已经是一个被包装过的响应式对象
  Object.defineProperty(obj, '__v_isrRef', {
    value: true,
  })
  return reactive(obj)
}

function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
  }
  // 标记他已经是一个被包装过的响应式对象
  Object.defineProperty(obj, '__v_isrRef', {
    value: true,
  })
  return wrapper
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      return value.__v_isRef ? value.value : value
    },
    set(target, key, newVal, receiver) {
      const value = target[key]
      if (value.__v_isRef) {
        value.value = newVal
        return true
      }
      return Reflect.set(target, key, newVal, receiver)
    },
  })
}

const count = ref(1)

effect(() => {
  console.log(count.value)
})

setTimeout(() => {
  count++
}, 100)
