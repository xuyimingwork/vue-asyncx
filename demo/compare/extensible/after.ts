import { confirmApi } from '../../api'
import { useAsync, withAddonGroup } from '../../../dist/vue-asyncx'

const { 
  confirm, 
  confirmGroup
} = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ key: (args) => args[0] })]
})
