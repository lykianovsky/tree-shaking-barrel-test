'use client'
import { CONSTANT_B, CONFIG_B } from '../../../../shared/constants-separate/b'

const ORIGIN = 'direct_file'

export default function Page2() {
  return <p>Page 2 ({ORIGIN}): {CONSTANT_B} - {CONFIG_B.name}</p>
}
