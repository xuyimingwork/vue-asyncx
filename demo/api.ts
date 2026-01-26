export function getUserApi(name: string): Promise<string> {
  return Promise.resolve(name)
}

export function getOrderApi(orderId: string): Promise<string> {
  return Promise.resolve(`订单 ${orderId}`)
}

export function confirmApi(id: number): Promise<string> {
  return Promise.resolve(`确认成功: ${id}`)
}