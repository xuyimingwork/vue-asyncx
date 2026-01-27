export function getUserApi(name: string): Promise<string> {
  return Promise.resolve(name)
}

export function getOptionsApi(name: string): Promise<string[]> {
  return Promise.resolve([
    'option1', 
    'option2', 
    'option3', 
    'option4',
    'option5'
  ])
}

export function getOrderListApi(name: string): Promise<string[]> {
  return Promise.resolve([
    'order1', 
    'order2', 
    'order3', 
    'order4',
    'order5'
  ])
}

export function getOrderApi(orderId: string): Promise<string> {
  return Promise.resolve(`订单 ${orderId}`)
}

export function confirmApi(id: number): Promise<string> {
  return Promise.resolve(`确认成功: ${id}`)
}