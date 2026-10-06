package com.atlasstudio.pocketkit;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Hardware sensors and network signal for the measuring tools. A web page cannot read most of these inside Android's WebView
 * (magnetometer, light, pressure, temperature, proximity and others). Readings go to the page as "sensor" events and everything is
 * stopped when the app is paused, so nothing keeps running in the background.
 */
@CapacitorPlugin(name = "PocketSensors")
public class PocketSensorsPlugin extends Plugin {

    private SensorManager sm;
    private final Map<Integer, SensorEventListener> active = new HashMap<>();
    private final Map<Integer, Long> lastEmit = new HashMap<>();

    private SensorManager manager() {
        if (sm == null) sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        return sm;
    }

    /** Friendly names the page uses, or a raw Android sensor type number as a string. */
    private static int typeOf(String name) {
        switch (name) {
            case "accelerometer": return Sensor.TYPE_ACCELEROMETER;
            case "gyroscope": return Sensor.TYPE_GYROSCOPE;
            case "magnetic": return Sensor.TYPE_MAGNETIC_FIELD;
            case "light": return Sensor.TYPE_LIGHT;
            case "pressure": return Sensor.TYPE_PRESSURE;
            case "temperature": return Sensor.TYPE_AMBIENT_TEMPERATURE;
            case "humidity": return Sensor.TYPE_RELATIVE_HUMIDITY;
            case "proximity": return Sensor.TYPE_PROXIMITY;
            case "gravity": return Sensor.TYPE_GRAVITY;
            case "linear": return Sensor.TYPE_LINEAR_ACCELERATION;
            case "rotation": return Sensor.TYPE_ROTATION_VECTOR;
            case "steps": return Sensor.TYPE_STEP_COUNTER;
            default:
                try { return Integer.parseInt(name); } catch (NumberFormatException e) { return -1; }
        }
    }

    /** Which sensors this phone has, with ranges, so the page can say what is available. */
    @PluginMethod
    public void listSensors(PluginCall call) {
        SensorManager m = manager();
        JSArray out = new JSArray();
        if (m != null) {
            List<Sensor> all = m.getSensorList(Sensor.TYPE_ALL);
            int n = 0;
            for (Sensor s : all) {
                if (n++ >= 120) break;
                JSObject o = new JSObject();
                o.put("name", s.getName());
                o.put("vendor", s.getVendor());
                o.put("type", s.getType());
                o.put("typeName", s.getStringType());
                o.put("maxRange", s.getMaximumRange());
                o.put("resolution", s.getResolution());
                o.put("power", s.getPower());
                o.put("minDelay", s.getMinDelay());
                out.put(o);
            }
        }
        JSObject r = new JSObject();
        r.put("sensors", out);
        call.resolve(r);
    }

    /** Is there a sensor of this kind? */
    @PluginMethod
    public void hasSensor(PluginCall call) {
        SensorManager m = manager();
        int type = typeOf(call.getString("type", ""));
        JSObject r = new JSObject();
        r.put("available", m != null && type >= 0 && m.getDefaultSensor(type) != null);
        call.resolve(r);
    }

    /** Start streaming one sensor as "sensor" events {type, values, accuracy, t}. Resolves with the sensor's details. */
    @PluginMethod
    public void startSensor(final PluginCall call) {
        final String key = call.getString("type", "");
        final int type = typeOf(key);
        SensorManager m = manager();
        JSObject r = new JSObject();
        Sensor s = (m == null || type < 0) ? null : m.getDefaultSensor(type);
        if (s == null) { r.put("available", false); call.resolve(r); return; }
        stop(type);
        final long minGapMs = Math.max(20, call.getInt("minGapMs", 50));
        final String name = key;
        SensorEventListener l = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) {
                long now = System.currentTimeMillis();
                Long last = lastEmit.get(type);
                if (last != null && now - last < minGapMs) return;
                lastEmit.put(type, now);
                JSObject o = new JSObject();
                JSArray v = new JSArray();
                try {
                    for (int i = 0; i < Math.min(e.values.length, 6); i++) v.put((double) e.values[i]);
                } catch (org.json.JSONException ignored) { return; }
                o.put("type", name);
                o.put("values", v);
                o.put("accuracy", e.accuracy);
                o.put("t", now);
                notifyListeners("sensor", o);
            }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        int delay = "fast".equals(call.getString("rate", "ui")) ? SensorManager.SENSOR_DELAY_GAME : SensorManager.SENSOR_DELAY_UI;
        boolean ok = m.registerListener(l, s, delay);
        if (!ok) { r.put("available", false); call.resolve(r); return; }
        active.put(type, l);
        r.put("available", true);
        r.put("name", s.getName());
        r.put("maxRange", s.getMaximumRange());
        r.put("resolution", s.getResolution());
        call.resolve(r);
    }

    private void stop(int type) {
        SensorEventListener l = active.remove(type);
        if (l != null && sm != null) sm.unregisterListener(l);
        lastEmit.remove(type);
    }

    @PluginMethod
    public void stopSensor(PluginCall call) {
        stop(typeOf(call.getString("type", "")));
        call.resolve();
    }

    @PluginMethod
    public void stopAll(PluginCall call) {
        stopEverything();
        call.resolve();
    }

    private void stopEverything() {
        if (sm != null) for (SensorEventListener l : active.values()) sm.unregisterListener(l);
        active.clear();
        lastEmit.clear();
    }

    @Override protected void handleOnPause() { stopEverything(); super.handleOnPause(); }
    @Override protected void handleOnDestroy() { stopEverything(); super.handleOnDestroy(); }

    /** Battery temperature in degrees C (phones often have no ambient temperature sensor, but they all report the battery's). */
    @PluginMethod
    public void batteryInfo(PluginCall call) {
        Intent i = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        JSObject r = new JSObject();
        if (i != null) {
            int t = i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
            if (t != Integer.MIN_VALUE) r.put("temperatureC", t / 10.0);
            int lvl = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            if (lvl >= 0 && scale > 0) r.put("percent", Math.round(100f * lvl / scale));
            int mv = i.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1);
            if (mv > 0) r.put("voltageMv", mv);
            r.put("charging", i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0);
        }
        call.resolve(r);
    }

    /** The active connection: kind (wifi, cellular, ethernet, none), signal in dBm when Android tells us, link speeds, and whether the internet works. */
    @PluginMethod
    public void networkSignal(PluginCall call) {
        JSObject r = new JSObject();
        r.put("type", "none");
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm == null ? null : cm.getActiveNetwork();
            NetworkCapabilities nc = n == null ? null : cm.getNetworkCapabilities(n);
            if (nc != null) {
                String type = nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ? "wifi"
                        : nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ? "cellular"
                        : nc.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ? "ethernet"
                        : nc.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) ? "bluetooth" : "other";
                r.put("type", type);
                r.put("validated", nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
                r.put("metered", !nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED));
                r.put("downKbps", nc.getLinkDownstreamBandwidthKbps());
                r.put("upKbps", nc.getLinkUpstreamBandwidthKbps());
                Integer dbm = null;
                if (Build.VERSION.SDK_INT >= 29) {
                    int s = nc.getSignalStrength();
                    if (s != Integer.MIN_VALUE) dbm = s;
                }
                if (dbm == null && "wifi".equals(type)) {
                    WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    WifiInfo wi = wm == null ? null : wm.getConnectionInfo();
                    if (wi != null && wi.getRssi() > -127 && wi.getRssi() < 0) dbm = wi.getRssi();
                }
                if (dbm != null) r.put("dbm", (int) dbm);
                if ("wifi".equals(type)) {
                    WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    WifiInfo wi = wm == null ? null : wm.getConnectionInfo();
                    if (wi != null) {
                        if (wi.getLinkSpeed() > 0) r.put("linkMbps", wi.getLinkSpeed());
                        if (wi.getFrequency() > 0) r.put("freqMhz", wi.getFrequency());
                    }
                }
            }
        } catch (Exception e) {
            r.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }
}
