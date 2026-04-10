'use client'
import { CONSTANT_C, CONFIG_C } from '../../../../shared/constants-separate/c'

const ORIGIN = 'direct_file'

export default function Page3() {
  return <p>Page 3 ({ORIGIN}): {CONSTANT_C} - {CONFIG_C.name}</p>
}
