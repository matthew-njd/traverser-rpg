import { type ConfigPlugin, withMainActivity } from 'expo/config-plugins';

/**
 * tech-03 §3 — registers `react-native-health-connect`'s permission delegate on MainActivity.
 *
 * ↯ **Without this the app hard-crashes the first time it asks for permission**, which is GDD 10
 * screen 2, which is the second screen of a first launch:
 *
 * ```
 * kotlin.UninitializedPropertyAccessException: lateinit property requestPermission has not been
 *   initialized
 *   at dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate.launchPermissionsDialog
 * ```
 *
 * The library holds its `ActivityResultLauncher` in a `lateinit` on an `object` singleton and
 * **never initialises it itself**. `setPermissionDelegate(activity)` is documented as the app's job
 * in `MainActivity.onCreate`, and the library's own `app.plugin.js` does not do it — that plugin
 * only pushes the Android-13-and-below rationale intent-filter into the manifest. Registering the
 * library and following its Expo instructions therefore leaves you with a build that compiles,
 * installs, launches, and dies on the permission tap.
 *
 * It has to be `onCreate`: `registerForActivityResult` throws if called after the activity has
 * STARTED, so this cannot be deferred into a module or done lazily from JS.
 *
 * ↯ And it has to be a config plugin rather than an edit to `MainActivity.kt`, because prebuild owns
 * `android/` (tech-04 §1.1) — a hand-edit survives exactly until the next `expo prebuild --clean`,
 * which is how this crash would come back months later with no apparent cause. Same reasoning as
 * `withHealthConnectRationale`, which exists for the other half of §2's setup.
 *
 * Found at P9 on the device. Nothing before it could have: the spike ran against a scratch app whose
 * MainActivity was edited by hand, and no test can reach a native `lateinit`.
 */
const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';

const REGISTRATION = '    HealthConnectPermissionDelegate.setPermissionDelegate(this)';

const withHealthConnectPermissionDelegate: ConfigPlugin = (config) =>
  withMainActivity(config, (mainActivityConfig) => {
    if (mainActivityConfig.modResults.language !== 'kt') {
      throw new Error(
        `withHealthConnectPermissionDelegate expects a Kotlin MainActivity, got "${mainActivityConfig.modResults.language}".`,
      );
    }

    let contents = mainActivityConfig.modResults.contents;

    // prebuild without `--clean` re-runs plugins over the file they already patched.
    if (contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
      return mainActivityConfig;
    }

    if (!contents.includes(IMPORT)) {
      contents = contents.replace(
        'import com.facebook.react.ReactActivity',
        `${IMPORT}\nimport com.facebook.react.ReactActivity`,
      );
    }

    // ↯ Anchored on `super.onCreate(`, not on the expo-splashscreen generated block above it — that
    // block carries a `DO NOT MODIFY` marker and a content hash, and its shape changes between SDK
    // releases. `super.onCreate(` is the one line in this method that is stable across templates.
    //
    // The delegate is registered *after* `super.onCreate`, which is where the activity is far enough
    // along to accept an activity-result contract and still short of STARTED.
    const anchor = contents.match(/^\s*super\.onCreate\([^)]*\)\s*$/m);

    if (anchor === null) {
      throw new Error(
        'withHealthConnectPermissionDelegate could not find super.onCreate(...) in MainActivity.kt — ' +
          'the template changed, and the Health Connect permission dialog will crash without this.',
      );
    }

    mainActivityConfig.modResults.contents = contents.replace(
      anchor[0],
      `${anchor[0]}\n    // tech-03 §3 — required by react-native-health-connect; see plugins/withHealthConnectPermissionDelegate.ts\n${REGISTRATION}`,
    );

    return mainActivityConfig;
  });

export default withHealthConnectPermissionDelegate;
