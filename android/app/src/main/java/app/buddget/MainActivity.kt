package app.buddget

import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(SmsCapacitorPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
