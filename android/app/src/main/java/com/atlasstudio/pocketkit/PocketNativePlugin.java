package com.atlasstudio.pocketkit;

import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Small native helpers the web layer cannot do itself. */
@CapacitorPlugin(name = "PocketNative")
public class PocketNativePlugin extends Plugin {

    /** True only in debug builds, so the debug-only Pro override and the 10-minute dev coupon stay inert in release. */
    @PluginMethod
    public void isDebuggable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("debuggable", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        call.resolve(r);
    }
}
