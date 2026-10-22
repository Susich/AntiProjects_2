const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. Patch Android SharingOptions.kt
try {
  const optionsKtPath = path.join(
    rootDir,
    'node_modules',
    'expo-sharing',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'sharing',
    'SharingOptions.kt'
  );

  if (fs.existsSync(optionsKtPath)) {
    let content = fs.readFileSync(optionsKtPath, 'utf8');
    if (!content.includes('val message: String?')) {
      content = content.replace(
        '@Field val dialogTitle: String?',
        '@Field val dialogTitle: String?,\n  @Field val message: String? = null'
      );
      fs.writeFileSync(optionsKtPath, content, 'utf8');
      console.log('[patch-expo-sharing] Patched SharingOptions.kt');
    }
  }
} catch (err) {
  console.warn('[patch-expo-sharing] Error patching SharingOptions.kt:', err.message);
}

// 2. Patch Android SharingModule.kt
try {
  const moduleKtPath = path.join(
    rootDir,
    'node_modules',
    'expo-sharing',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'sharing',
    'SharingModule.kt'
  );

  if (fs.existsSync(moduleKtPath)) {
    let content = fs.readFileSync(moduleKtPath, 'utf8');
    let modified = false;

    if (!content.includes('Intent.EXTRA_TEXT')) {
      content = content.replace(
        'private fun createSharingIntent(uri: Uri, mimeType: String?) =\n    Intent(Intent.ACTION_SEND).apply {\n      putExtra(Intent.EXTRA_STREAM, uri)\n      setTypeAndNormalize(mimeType)\n      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)\n    }',
        'private fun createSharingIntent(uri: Uri, mimeType: String?, message: String? = null) =\n    Intent(Intent.ACTION_SEND).apply {\n      putExtra(Intent.EXTRA_STREAM, uri)\n      if (!message.isNullOrBlank()) {\n        putExtra(Intent.EXTRA_TEXT, message)\n      }\n      setTypeAndNormalize(mimeType)\n      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)\n    }'
      );
      content = content.replace(
        'createSharingIntent(contentUri, mimeType),',
        'createSharingIntent(contentUri, mimeType, params.message),'
      );
      fs.writeFileSync(moduleKtPath, content, 'utf8');
      console.log('[patch-expo-sharing] Patched SharingModule.kt');
      modified = true;
    }
  }
} catch (err) {
  console.warn('[patch-expo-sharing] Error patching SharingModule.kt:', err.message);
}

// 3. Patch iOS SharingOptions.swift
try {
  const optionsSwiftPath = path.join(
    rootDir,
    'node_modules',
    'expo-sharing',
    'ios',
    'SharingOptions.swift'
  );

  if (fs.existsSync(optionsSwiftPath)) {
    let content = fs.readFileSync(optionsSwiftPath, 'utf8');
    if (!content.includes('var message: String?')) {
      content = content.replace(
        '@Field var dialogTitle: String?',
        '@Field var dialogTitle: String?\n  @Field var message: String?'
      );
      fs.writeFileSync(optionsSwiftPath, content, 'utf8');
      console.log('[patch-expo-sharing] Patched SharingOptions.swift');
    }
  }
} catch (err) {
  console.warn('[patch-expo-sharing] Error patching SharingOptions.swift:', err.message);
}

// 4. Patch iOS SharingModule.swift
try {
  const moduleSwiftPath = path.join(
    rootDir,
    'node_modules',
    'expo-sharing',
    'ios',
    'SharingModule.swift'
  );

  if (fs.existsSync(moduleSwiftPath)) {
    let content = fs.readFileSync(moduleSwiftPath, 'utf8');
    if (!content.includes('activityItems.append(message)')) {
      content = content.replace(
        'let activityController = UIActivityViewController(activityItems: [shareURL], applicationActivities: nil)',
        'var activityItems: [Any] = [shareURL]\n      if let message = options.message, !message.isEmpty {\n        activityItems.append(message)\n      }\n      let activityController = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)'
      );
      fs.writeFileSync(moduleSwiftPath, content, 'utf8');
      console.log('[patch-expo-sharing] Patched SharingModule.swift');
    }
  }
} catch (err) {
  console.warn('[patch-expo-sharing] Error patching SharingModule.swift:', err.message);
}

// 5. Patch TypeScript type definitions
const typesPaths = [
  path.join(rootDir, 'node_modules', 'expo-sharing', 'build', 'Sharing.types.d.ts'),
  path.join(rootDir, 'node_modules', 'expo-sharing', 'src', 'Sharing.types.ts'),
];

for (const tPath of typesPaths) {
  try {
    if (fs.existsSync(tPath)) {
      let content = fs.readFileSync(tPath, 'utf8');
      if (!content.includes('message?: string;')) {
        content = content.replace(
          'dialogTitle?: string;',
          'dialogTitle?: string;\n  message?: string;'
        );
        fs.writeFileSync(tPath, content, 'utf8');
        console.log(`[patch-expo-sharing] Patched ${path.basename(tPath)}`);
      }
    }
  } catch (err) {
    console.warn(`[patch-expo-sharing] Error patching ${tPath}:`, err.message);
  }
}

// 6. Patch Web implementation
const webBuildPath = path.join(
  rootDir,
  'node_modules',
  'expo-sharing',
  'build',
  'SharingNativeModule.web.js'
);

try {
  if (fs.existsSync(webBuildPath)) {
    let content = fs.readFileSync(webBuildPath, 'utf8');
    if (!content.includes('const text = options.text || options.message;')) {
      content = content.replace(
        `        if (navigator.share) {
            await navigator.share({
                ...options,
                url
            });`,
        `        if (navigator.share) {
            const title = options.title || options.dialogTitle;
            const text = options.text || options.message;
            await navigator.share({
                ...options,
                ...(title ? { title } : {}),
                ...(text ? { text } : {}),
                url
            });`
      );
      fs.writeFileSync(webBuildPath, content, 'utf8');
      console.log('[patch-expo-sharing] Patched SharingNativeModule.web.js');
    }
  }
} catch (err) {
  console.warn('[patch-expo-sharing] Error patching web module:', err.message);
}
