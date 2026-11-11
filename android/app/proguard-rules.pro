# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# R8 (release): shrink third-party code, keep everything the WebView bridge, WorkManager and manifest reach by name.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
-keep class app.buddget.** { *; }
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod <methods>; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keep class * extends androidx.work.ListenableWorker { <init>(...); }
-keep class io.sentry.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn org.slf4j.**
-dontwarn javax.annotation.**
