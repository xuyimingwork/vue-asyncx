import { confirmApi } from '../../api'
import { useAsync, withAddonGroup } from '../../../dist/vue-asyncx'

const { 
  confirm, 
  confirmGroup
} = useAsync('confirm', confirmApi, {
  addons: [withAddonGroup({ by: (args) => args[0] })]
})
