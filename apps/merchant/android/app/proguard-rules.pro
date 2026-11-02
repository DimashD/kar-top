# Flutter + плагины. Flutter тянет свои keep-правила; здесь — подстраховка.
-keep class io.flutter.** { *; }
-keep class com.google.crypto.** { *; }
# local_auth / androidx biometric
-keep class androidx.biometric.** { *; }
-dontwarn javax.annotation.**
