'use client'
import { CONSTANT_A, CONFIG_A } from '../../../shared/constants-separate'

export default function Page1() {
  return <p>Page 1: {CONSTANT_A} - {CONFIG_A.name}</p>
}
