'use client'
import { CONSTANT_A, CONFIG_A } from '../../../shared/constants-separate/a'

const ORIGIN = 'direct_file'

export default function Page1() {
  return <p>Page 1 ({ORIGIN}): {CONSTANT_A} - {CONFIG_A.name}</p>
}
