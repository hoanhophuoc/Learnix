export default {
  scope: 'changed',
  rules: {
    // Existing IDE orchestration is intentionally centralized to preserve the
    // execution and preview state machine.
    'react-doctor/no-high-complexity-react-function': 'off',
    // React Compiler cannot memoize this download helper because it uses
    // imperative DOM APIs; its object URL is explicitly revoked below.
    'react-hooks-js/todo': 'off',
  },
};
