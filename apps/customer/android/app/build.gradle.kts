import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Релизная подпись: ключи из android/key.properties (не в git). См. docs/23.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "kz.kartop.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Клиентское приложение Kartop (ссылка Google Play на сайте ведёт на этот id).
        applicationId = "kz.kartop.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = maxOf(23, flutter.minSdkVersion)
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // Два варианта приложения покупателя (ставятся на телефон РЯДОМ):
    //   prod    — kz.kartop.app,         «Kartop»,           сайт kar-top.kz;
    //   staging — kz.kartop.app.staging, «Kartop ТЕСТ клиент», сайт test.kar-top.kz.
    // Сборка: flutter build apk --flavor staging --dart-define=WEB_BASE=https://test.kar-top.kz
    flavorDimensions += "env"
    productFlavors {
        create("prod") {
            dimension = "env"
            manifestPlaceholders["appName"] = "Kartop"
            manifestPlaceholders["webHost"] = "kar-top.kz"
        }
        create("staging") {
            dimension = "env"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            manifestPlaceholders["appName"] = "Kartop ТЕСТ клиент"
            manifestPlaceholders["webHost"] = "test.kar-top.kz"
        }
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String?
                keyPassword = keystoreProperties["keyPassword"] as String?
                storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
                storePassword = keystoreProperties["storePassword"] as String?
            }
        }
    }

    buildTypes {
        release {
            // Если key.properties есть — подписываем релизным ключом, иначе debug (для локального --release).
            signingConfig = if (keystorePropertiesFile.exists()) signingConfigs.getByName("release")
                            else signingConfigs.getByName("debug")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

