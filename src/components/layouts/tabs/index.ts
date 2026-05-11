import Tabs from './Tabs.vue'
import Tab from './Tab.vue'
import { withInstall } from 'Utils/withInstall'
import './style'

export const WTabs = withInstall(Tabs)
export const WTab = withInstall(Tab)

export default WTabs

export * from './Tabs.vue'
export * from './Tab.vue'
