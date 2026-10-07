package com.atlasstudio.pocketkit;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.LocationManager;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiManager;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Device tools that need Android APIs a web page cannot reach: nearby Wi-Fi networks, nearby Bluetooth devices, NFC tags, battery health
 * and storage use. Results go to the screen only: nothing is stored or sent anywhere. Scanning stops when the app is paused.
 */
@CapacitorPlugin(name = "PocketDevice", permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "btNew", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT })
})
public class PocketDevicePlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private NfcAdapter nfc;
    private boolean nfcOn = false;
    private ScanCallback bleCallback;

    /* ------------------------------------------------------------------ Wi-Fi networks nearby */

    @PluginMethod
    public void wifiScan(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { requestPermissionForAlias("location", call, "wifiPerm"); return; }
        doWifi(call);
    }

    @PermissionCallback
    private void wifiPerm(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) doWifi(call); else call.reject("permission");
    }

    private static String wifiSecurity(String caps) {
        if (caps == null) return "Unknown";
        String c = caps.toUpperCase();
        if (c.contains("SAE")) return "WPA3";
        if (c.contains("WPA2") || c.contains("RSN")) return "WPA2";
        if (c.contains("WPA")) return "WPA";
        if (c.contains("WEP")) return "WEP";
        if (c.contains("OWE")) return "Open (encrypted)";
        return "Open";
    }

    private static int wifiChannel(int mhz) {
        if (mhz == 2484) return 14;
        if (mhz >= 2412 && mhz <= 2472) return (mhz - 2407) / 5;
        if (mhz >= 5170 && mhz <= 5895) return (mhz - 5000) / 5;
        if (mhz >= 5955 && mhz <= 7115) return (mhz - 5950) / 5;
        return 0;
    }

    @SuppressWarnings("deprecation")
    private void doWifi(final PluginCall call) {
        final JSObject r = new JSObject();
        try {
            final WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            boolean locOn = lm == null || (Build.VERSION.SDK_INT >= 28 ? lm.isLocationEnabled() : true);
            if (wm == null) { r.put("available", false); call.resolve(r); return; }
            r.put("available", true);
            r.put("wifiOn", wm.isWifiEnabled());
            r.put("locationOn", locOn);
            if (!wm.isWifiEnabled()) { r.put("networks", new JSArray()); call.resolve(r); return; }
            boolean started = false;
            try { started = wm.startScan(); } catch (SecurityException ignored) { }
            final boolean fresh = started;
            main.postDelayed(() -> {
                try {
                    List<ScanResult> list = wm.getScanResults();
                    List<ScanResult> sorted = new ArrayList<>(list == null ? Collections.<ScanResult>emptyList() : list);
                    Collections.sort(sorted, new Comparator<ScanResult>() { @Override public int compare(ScanResult a, ScanResult b) { return b.level - a.level; } });
                    JSArray arr = new JSArray();
                    int n = 0;
                    for (ScanResult s : sorted) {
                        if (n++ >= 80) break;
                        JSObject o = new JSObject();
                        String ssid = s.SSID == null ? "" : s.SSID;
                        o.put("ssid", ssid);
                        o.put("hidden", ssid.isEmpty());
                        o.put("level", s.level);
                        o.put("freq", s.frequency);
                        o.put("channel", wifiChannel(s.frequency));
                        o.put("security", wifiSecurity(s.capabilities));
                        arr.put(o);
                    }
                    r.put("networks", arr);
                    r.put("fresh", fresh);
                } catch (SecurityException e) {
                    r.put("error", "permission");
                } catch (Exception e) {
                    r.put("error", String.valueOf(e.getMessage()));
                }
                call.resolve(r);
            }, started ? 2600 : 200);
        } catch (Exception e) {
            r.put("error", String.valueOf(e.getMessage()));
            call.resolve(r);
        }
    }

    /* ------------------------------------------------------------------ Bluetooth devices nearby */

    @PluginMethod
    public void bluetoothScan(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 31 ? "btNew" : "location";
        if (getPermissionState(alias) != PermissionState.GRANTED) { requestPermissionForAlias(alias, call, "btPerm"); return; }
        doBluetooth(call);
    }

    @PermissionCallback
    private void btPerm(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= 31 ? "btNew" : "location";
        if (getPermissionState(alias) == PermissionState.GRANTED) doBluetooth(call); else call.reject("permission");
    }

    @SuppressWarnings("MissingPermission")
    private void doBluetooth(final PluginCall call) {
        final JSObject r = new JSObject();
        try {
            BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            final BluetoothAdapter ad = bm == null ? null : bm.getAdapter();
            if (ad == null) { r.put("available", false); call.resolve(r); return; }
            r.put("available", true);
            r.put("enabled", ad.isEnabled());
            if (!ad.isEnabled()) { r.put("devices", new JSArray()); call.resolve(r); return; }
            final Map<String, JSObject> found = new HashMap<>();
            // paired devices first
            try {
                Set<BluetoothDevice> bonded = ad.getBondedDevices();
                if (bonded != null) for (BluetoothDevice d : bonded) {
                    JSObject o = new JSObject();
                    o.put("name", d.getName() == null ? "" : d.getName());
                    o.put("address", d.getAddress());
                    o.put("paired", true);
                    o.put("type", d.getType());
                    found.put(d.getAddress(), o);
                }
            } catch (SecurityException ignored) { }
            final BluetoothLeScanner sc = ad.getBluetoothLeScanner();
            final int seconds = Math.max(2, Math.min(15, call.getInt("seconds", 6)));
            if (sc == null) { finishBluetooth(call, r, found); return; }
            if (bleCallback != null) { try { sc.stopScan(bleCallback); } catch (Exception ignored) { } }
            bleCallback = new ScanCallback() {
                @Override public void onScanResult(int callbackType, android.bluetooth.le.ScanResult res) {
                    try {
                        BluetoothDevice d = res.getDevice();
                        JSObject o = found.get(d.getAddress());
                        if (o == null) { o = new JSObject(); o.put("address", d.getAddress()); o.put("paired", false); found.put(d.getAddress(), o); }
                        String nm = res.getScanRecord() != null ? res.getScanRecord().getDeviceName() : null;
                        if (nm == null) { try { nm = d.getName(); } catch (SecurityException ignored) { } }
                        if (nm != null && !nm.isEmpty()) o.put("name", nm);
                        o.put("rssi", res.getRssi());
                    } catch (Exception ignored) { }
                }
            };
            sc.startScan(null, new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), bleCallback);
            main.postDelayed(() -> {
                try { sc.stopScan(bleCallback); } catch (Exception ignored) { }
                bleCallback = null;
                finishBluetooth(call, r, found);
            }, seconds * 1000L);
        } catch (SecurityException e) {
            r.put("error", "permission"); call.resolve(r);
        } catch (Exception e) {
            r.put("error", String.valueOf(e.getMessage())); call.resolve(r);
        }
    }

    private void finishBluetooth(PluginCall call, JSObject r, Map<String, JSObject> found) {
        List<JSObject> list = new ArrayList<>(found.values());
        Collections.sort(list, new Comparator<JSObject>() {
            @Override public int compare(JSObject a, JSObject b) { return b.optInt("rssi", -200) - a.optInt("rssi", -200); }
        });
        JSArray arr = new JSArray();
        int n = 0;
        for (JSObject o : list) { if (n++ >= 100) break; arr.put(o); }
        r.put("devices", arr);
        call.resolve(r);
    }

    /* ------------------------------------------------------------------ NFC tag reader */

    private static final String[] URI_PREFIX = { "", "http://www.", "https://www.", "http://", "https://", "tel:", "mailto:", "ftp://anonymous:anonymous@", "ftp://ftp.", "ftps://", "sftp://", "smb://", "nfs://", "ftp://", "dav://", "news:", "telnet://", "imap:", "rtsp://", "urn:", "pop:", "sip:", "sips:", "tftp:", "btspp://", "btl2cap://", "btgoep://", "tcpobex://", "irdaobex://", "file://", "urn:epc:id:", "urn:epc:tag:", "urn:epc:pat:", "urn:epc:raw:", "urn:epc:", "urn:nfc:" };

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < b.length; i++) { if (i > 0) sb.append(':'); sb.append(String.format("%02X", b[i])); }
        return sb.toString();
    }

    private JSObject describeRecord(NdefRecord rec) {
        JSObject o = new JSObject();
        try {
            short tnf = rec.getTnf();
            byte[] type = rec.getType(), payload = rec.getPayload();
            if (tnf == NdefRecord.TNF_WELL_KNOWN && java.util.Arrays.equals(type, NdefRecord.RTD_TEXT) && payload.length > 0) {
                int langLen = payload[0] & 0x3F;
                String enc = (payload[0] & 0x80) == 0 ? "UTF-8" : "UTF-16";
                o.put("kind", "text");
                o.put("value", new String(payload, langLen + 1, payload.length - langLen - 1, Charset.forName(enc)));
                o.put("lang", new String(payload, 1, langLen, Charset.forName("US-ASCII")));
            } else if (tnf == NdefRecord.TNF_WELL_KNOWN && java.util.Arrays.equals(type, NdefRecord.RTD_URI) && payload.length > 0) {
                int p = payload[0] & 0xFF;
                o.put("kind", "uri");
                o.put("value", (p < URI_PREFIX.length ? URI_PREFIX[p] : "") + new String(payload, 1, payload.length - 1, Charset.forName("UTF-8")));
            } else if (tnf == NdefRecord.TNF_MIME_MEDIA) {
                o.put("kind", "mime");
                o.put("mime", new String(type, Charset.forName("US-ASCII")));
                o.put("size", payload.length);
                String m = new String(type, Charset.forName("US-ASCII"));
                if (m.startsWith("text/") && payload.length < 2000) o.put("value", new String(payload, Charset.forName("UTF-8")));
            } else {
                o.put("kind", "other");
                o.put("tnf", (int) tnf);
                o.put("size", payload.length);
            }
        } catch (Exception e) {
            o.put("kind", "other");
        }
        return o;
    }

    private void emitTag(Tag tag) {
        JSObject o = new JSObject();
        try {
            o.put("id", hex(tag.getId()));
            JSArray techs = new JSArray();
            for (String t : tag.getTechList()) techs.put(t.substring(t.lastIndexOf('.') + 1));
            o.put("tech", techs);
            JSArray recs = new JSArray();
            Ndef ndef = Ndef.get(tag);
            if (ndef != null) {
                o.put("type", ndef.getType());
                o.put("maxSize", ndef.getMaxSize());
                o.put("writable", ndef.isWritable());
                NdefMessage msg = ndef.getCachedNdefMessage();
                if (msg != null) for (NdefRecord rec : msg.getRecords()) recs.put(describeRecord(rec));
            }
            o.put("records", recs);
        } catch (Exception e) {
            o.put("error", String.valueOf(e.getMessage()));
        }
        notifyListeners("nfc", o);
    }

    @PluginMethod
    public void startNfc(PluginCall call) {
        JSObject r = new JSObject();
        nfc = NfcAdapter.getDefaultAdapter(getContext());
        if (nfc == null) { r.put("available", false); call.resolve(r); return; }
        r.put("available", true);
        r.put("enabled", nfc.isEnabled());
        if (!nfc.isEnabled()) { call.resolve(r); return; }
        final Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                nfc.enableReaderMode(a, new NfcAdapter.ReaderCallback() { @Override public void onTagDiscovered(Tag tag) { emitTag(tag); } },
                        NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK * 0, null);
                nfcOn = true;
            } catch (Exception e) { nfcOn = false; }
            call.resolve(r);
        });
    }

    private void stopNfcNow() {
        if (nfc != null && nfcOn) {
            final Activity a = getActivity();
            if (a != null) a.runOnUiThread(() -> { try { nfc.disableReaderMode(a); } catch (Exception ignored) { } });
        }
        nfcOn = false;
    }

    @PluginMethod
    public void stopNfc(PluginCall call) { stopNfcNow(); call.resolve(); }

    @Override protected void handleOnPause() { stopNfcNow(); super.handleOnPause(); }
    @Override protected void handleOnDestroy() { stopNfcNow(); super.handleOnDestroy(); }

    /* ------------------------------------------------------------------ battery health and storage */

    @PluginMethod
    public void batteryHealth(PluginCall call) {
        JSObject r = new JSObject();
        Intent i = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (i != null) {
            int h = i.getIntExtra(BatteryManager.EXTRA_HEALTH, 0);
            String[] names = { "Unknown", "Unknown", "Good", "Overheating", "Dead", "Over voltage", "Failure", "Cold" };
            r.put("health", h >= 0 && h < names.length ? names[h] : "Unknown");
            int lvl = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            if (lvl >= 0 && scale > 0) r.put("percent", Math.round(100f * lvl / scale));
            int t = i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
            if (t != Integer.MIN_VALUE) r.put("temperatureC", t / 10.0);
            int mv = i.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1);
            if (mv > 0) r.put("voltageMv", mv);
            String tech = i.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY);
            if (tech != null) r.put("technology", tech);
            int plugged = i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
            r.put("plugged", plugged == 0 ? "No" : plugged == BatteryManager.BATTERY_PLUGGED_USB ? "USB" : plugged == BatteryManager.BATTERY_PLUGGED_AC ? "AC charger" : plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS ? "Wireless" : "Yes");
            int st = i.getIntExtra(BatteryManager.EXTRA_STATUS, 0);
            r.put("status", st == BatteryManager.BATTERY_STATUS_CHARGING ? "Charging" : st == BatteryManager.BATTERY_STATUS_FULL ? "Full" : st == BatteryManager.BATTERY_STATUS_DISCHARGING ? "Discharging" : st == BatteryManager.BATTERY_STATUS_NOT_CHARGING ? "Not charging" : "Unknown");
        }
        try {
            BatteryManager bm = (BatteryManager) getContext().getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                int cur = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
                if (cur != Integer.MIN_VALUE && cur != 0) r.put("currentMa", Math.round(cur / 1000.0));
                int cc = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
                if (cc != Integer.MIN_VALUE && cc > 0) r.put("chargeMah", Math.round(cc / 1000.0));
                if (Build.VERSION.SDK_INT >= 34) {
                    int soh = bm.getIntProperty(10 /* BATTERY_PROPERTY_STATE_OF_HEALTH, API 34 */);
                    if (soh != Integer.MIN_VALUE && soh > 0 && soh <= 100) r.put("stateOfHealth", soh);
                }
            }
        } catch (Exception ignored) { }
        call.resolve(r);
    }

    private static long dirSize(File f, int depth) {
        if (f == null || !f.exists() || depth > 8) return 0;
        if (f.isFile()) return f.length();
        long n = 0; File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) n += dirSize(k, depth + 1);
        return n;
    }

    private static boolean deleteContents(File dir, int depth) {
        if (dir == null || !dir.exists() || depth > 8) return true;
        boolean ok = true; File[] kids = dir.listFiles();
        if (kids != null) for (File k : kids) { if (k.isDirectory()) ok &= deleteContents(k, depth + 1); ok &= k.delete(); }
        return ok;
    }

    @PluginMethod
    public void storageInfo(PluginCall call) {
        JSObject r = new JSObject();
        try {
            StatFs d = new StatFs(Environment.getDataDirectory().getPath());
            r.put("totalBytes", d.getTotalBytes());
            r.put("freeBytes", d.getAvailableBytes());
        } catch (Exception ignored) { }
        try {
            r.put("appCacheBytes", dirSize(getContext().getCacheDir(), 0));
            r.put("appDataBytes", dirSize(getContext().getFilesDir(), 0));
        } catch (Exception ignored) { }
        call.resolve(r);
    }

    /** Clears only PocketKit's own cache folder (temporary share files). Never touches saved tool data. */
    @PluginMethod
    public void clearAppCache(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", deleteContents(getContext().getCacheDir(), 0));
        r.put("appCacheBytes", dirSize(getContext().getCacheDir(), 0));
        call.resolve(r);
    }
}
