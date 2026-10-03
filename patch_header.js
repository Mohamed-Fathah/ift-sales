const fs = require('fs');
const filePath = 'src/components/layout/Header.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('SyncOfflineButton')) {
  content = content.replace(
    /import \{ useAuthStore \} from '@\/store\/auth\.store'/,
    "import { useAuthStore } from '@/store/auth.store'\nimport SyncOfflineButton from './SyncOfflineButton'"
  );

  content = content.replace(
    /<div className="flex items-center gap-3">\n        \{user && \(/,
    '<div className="flex items-center gap-3">\n        <SyncOfflineButton />\n        {user && ('
  );

  fs.writeFileSync(filePath, content, 'utf8');
}
