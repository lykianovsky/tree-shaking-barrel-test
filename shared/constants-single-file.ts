// Кейс 1: Все экспорты в одном файле
export const CONSTANT_A = 'value_a_from_single_file'
export const CONSTANT_B = 'value_b_from_single_file'
export const CONSTANT_C = 'value_c_from_single_file'

export const CONFIG_A = {
  name: 'config_a',
  value: 1,
  nested: { deep: true },
}

export const CONFIG_B = {
  name: 'config_b',
  value: 2,
  nested: { deep: false },
}

export const CONFIG_C = {
  name: 'config_c',
  value: 3,
  nested: { deep: true },
}
