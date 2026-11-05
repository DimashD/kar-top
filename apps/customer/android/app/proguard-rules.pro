# Flutter + плагины. Flutter тянет свои keep-правила; здесь — подстраховка.
-keep class io.flutter.** { *; }
-keep class com.google.crypto.** { *; }
# local_auth / androidx biometric
-keep class androidx.biometric.** { *; }
-dontwarn javax.annotation.**

# Flutter embedding ссылается на Play Core (deferred components), который мы не используем.
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }
# Firebase/Messaging — на всякий случай
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
