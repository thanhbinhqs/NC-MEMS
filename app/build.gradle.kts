plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ncmems.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ncmems.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")

    // Zebra Barcode Scanner SDK
    // Download the AAR from https://www.zebra.com/us/en/support-downloads/software/scanner-software/scanner-sdk-for-android.html
    // Place in app/libs/ and uncomment below:
    // implementation(files("libs/barcode_scanner_library_v2.6.4.0-release.aar"))
    //
    // Alternative: add Zebra Maven repo (if available for your version):
    // repositories { maven { url = uri("https://zebratech.jfrog.io/artifactory/EMDK-Android/") } }
    // implementation("com.zebra:barcode-scanner-library:2.6.22.0")
}
