import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Direct Gradle runs can use GITPULSE_ANDROID_*. `flutter build` replaces the
// Gradle environment with JAVA_HOME and PATH, so it reads android/key.properties.
val releaseProperties = Properties().apply {
    val propertiesFile = rootProject.file("key.properties")
    if (propertiesFile.isFile) {
        propertiesFile.inputStream().use { load(it) }
    }
}
val releaseSigning = mapOf(
    "storeFile" to "GITPULSE_ANDROID_KEYSTORE_PATH",
    "storePassword" to "GITPULSE_ANDROID_STORE_PASSWORD",
    "keyAlias" to "GITPULSE_ANDROID_KEY_ALIAS",
    "keyPassword" to "GITPULSE_ANDROID_KEY_PASSWORD",
).mapValues { (property, environment) ->
    providers.environmentVariable(environment).orNull
        ?: releaseProperties.getProperty(property)
}
val validateReleaseSigning = tasks.register("validateReleaseSigning") {
    doLast {
        check(releaseSigning.values.all { !it.isNullOrBlank() }) {
            "Release signing requires storeFile, storePassword, keyAlias, and keyPassword " +
                "in android/key.properties or the GITPULSE_ANDROID_* environment variables. " +
                "See ../docs/flutter-release.md. Debug signing is not a release fallback."
        }
        check(!releaseSigning["keyAlias"].equals("androiddebugkey", ignoreCase = true)) {
            "The Android debug key cannot be used for a formal release."
        }
        check(rootProject.file(releaseSigning.getValue("storeFile")!!).isFile) {
            "The configured release keystore does not exist."
        }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseSigning)
}

android {
    namespace = "ink.euphony.gitpulse"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_25
        targetCompatibility = JavaVersion.VERSION_25
    }

    defaultConfig {
        applicationId = "ink.euphony.gitpulse"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            storeFile = releaseSigning["storeFile"]?.let { rootProject.file(it) }
            storePassword = releaseSigning["storePassword"]
            keyAlias = releaseSigning["keyAlias"]
            keyPassword = releaseSigning["keyPassword"]
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_25
    }
}

flutter {
    source = "../.."
}
