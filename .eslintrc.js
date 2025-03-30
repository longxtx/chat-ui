module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    // 暂时关闭模块引入错误
    'import/no-unresolved': 'off',
    '@typescript-eslint/ban-ts-comment': 'off'
  }
}
