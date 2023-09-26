// 不够完善，没有对遍历和一些方法进行重写
let activeEffect
let effectStack = []

const TRIGGER_TYPE = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE',
}

function effect(fn, options = {}) {
  const effectFn = function () {
    cleanup(effectFn)
    activeEffect = effect
    effectStack.push(fn)
    const res = fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.deps = []
  effectFn.options = options
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps = []
}

const reactiveMap = new Map()
function reactive(obj) {
  const existionProxy = reactiveMap.get(obj)

  if (existionProxy) return existionProxy

  const proxy = createReactive(obj)
  reactiveMap.set(obj, proxy)
  return proxy
}

let shouldTrack = true
// ...

// 重写Set、Map上的所有方法，手动触发track/trigger
const mutableInstrumentations = {
  add(key) {
    const target = this.raw
    const hadKey = target.has(key)
    // 已经存在的添加不重复触发
    if (!hadKey) {
      target.add(key)
      trigger(target, key, TRIGGER_TYPE.ADD)
    }
  },
  get(key) {
    const target = this.raw
    const hadKey = target.has(key)

    track(target, key)
    if (hadKey) {
      const res = target.get(res)
      return typeof res === 'object' ? reactive(res) : res
    }
  },
  set(key, value) {
    const target = this.raw
    const had = target.has(key)

    const oldValue = target.get(key)
    target.set(key, value)
    if (!had) {
      trigger(target, key, TRIGGER_TYPE.ADD)
    } else if (
      value !== oldValue &&
      (value === value || oldValue === oldValue)
    ) {
      trigger(target, key, TRIGGER_TYPE.SET)
    }
  },
}

const ITERATE_KEY = Symbol()
const bucket = new WeakMap()
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'raw') return target
      if (key === 'size') {
        track(target, ITERATE_KEY)
        // 因为 size 是一个 getter，如果第三个参数不指向它自身，代理本身是没有size的内部实现的
        return Reflect.get(target, key, target)
      }

      return mutableInstrumentations[key]
    },
  })
}

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
