import { beforeAll } from "vitest"
import { install, isVue2, Vue2 } from 'vue-demi'

function setupVueSwitch() {
  if (isVue2) {
    Vue2.config.productionTip = false
    Vue2.config.devtools = false
    install(Vue2)
  }
}

setupVueSwitch()

beforeAll(() => setupVueSwitch())