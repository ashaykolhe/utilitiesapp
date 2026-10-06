package com.atlasstudio.pocketkit;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PersistableBundle;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Small native helpers the web layer cannot do itself. */
@CapacitorPlugin(name = "PocketNative")
public class PocketNativePlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private String lastClipLabel = null;

    /** True only in debug builds, so the debug-only Pro override and the 10-minute dev coupon stay inert in release. */
    @PluginMethod
    public void isDebuggable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("debuggable", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        call.resolve(r);
    }

    /** FLAG_SECURE hides the app in the recent-apps preview and blocks screenshots while a vault, locker or 2FA screen is unlocked. */
    @PluginMethod
    public void setSecure(final PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    /** Copies a secret, marks it sensitive (hides the Android 13+ clipboard preview) and clears it after clearMs unless something else was copied since. */
    @PluginMethod
    public void copySensitive(final PluginCall call) {
        final String text = call.getString("text", "");
        final long clearMs = call.getLong("clearMs", 30000L);
        final ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null) { call.reject("no clipboard"); return; }
        final String label = "pocketkit-" + System.nanoTime();
        ClipData clip = ClipData.newPlainText(label, text);
        if (Build.VERSION.SDK_INT >= 33) {
            PersistableBundle extras = new PersistableBundle();
            extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true);
            clip.getDescription().setExtras(extras);
        }
        cm.setPrimaryClip(clip);
        lastClipLabel = label;
        main.postDelayed(() -> {
            try {
                ClipDescription d = cm.getPrimaryClipDescription();
                if (d != null && label.equals(lastClipLabel) && label.contentEquals(d.getLabel() == null ? "" : d.getLabel())) {
                    if (Build.VERSION.SDK_INT >= 28) cm.clearPrimaryClip(); else cm.setPrimaryClip(ClipData.newPlainText("", ""));
                }
            } catch (Exception ignored) { }
        }, clearMs);
        JSObject r = new JSObject();
        r.put("native", true);
        call.resolve(r);
    }
}
