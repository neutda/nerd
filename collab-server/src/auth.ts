/** LAN 협업은 토큰 없이 허용합니다. 필요하면 나중에 방 암호를 붙입니다. */
export function authorize(_token?: string): boolean {
  return true
}
