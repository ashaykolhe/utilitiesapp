package com.atlasstudio.pocketkit;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

/**
 * Google Drive sign-in through Google's Authorization API. The phone hands back a short-lived access token for the
 * drive.appdata scope (a hidden per-app folder in the person's Drive) plus the email scope (only to show "Connected as ...").
 * The web side then talks to Drive's REST API with that token. No password or client secret is in the app: Google matches the
 * app by package name plus signing certificate (see docs/GOOGLE-DRIVE-SETUP.md).
 */
@CapacitorPlugin(name = "PocketDrive", requestCodes = {9411}) // 9411 = RC_DRIVE: Google's consent result is routed back here by request code
public class PocketDrivePlugin extends Plugin {

    private static final int RC_DRIVE = 9411;
    private PluginCall driveCall;

    private static void reply(PluginCall call, String error, String token) {
        JSObject r = new JSObject();
        if (error != null) r.put("error", error);
        if (token != null) r.put("accessToken", token);
        call.resolve(r);
    }

    private static String errorCode(Exception e) {
        if (e instanceof ApiException) {
            int c = ((ApiException) e).getStatusCode();
            if (c == 10) return "setup";                  // DEVELOPER_ERROR: OAuth client / SHA-1 not registered for this build
            if (c == 7) return "network";                 // NETWORK_ERROR
            if (c == 12501 || c == 16) return "cancelled"; // SIGN_IN_CANCELLED / CANCELED
        }
        String m = String.valueOf(e.getMessage());
        if (m.contains("10:") || m.contains("DEVELOPER_ERROR")) return "setup";
        return "cancelled";
    }

    /**
     * Resolves {accessToken}, or {error: "consent" | "setup" | "network" | "cancelled"}.
     * With interactive=false it never shows any screen: if Google needs the person's consent it answers "consent".
     */
    @PluginMethod
    public void authorize(final PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                    .setRequestedScopes(java.util.Arrays.asList(
                            new Scope("https://www.googleapis.com/auth/drive.appdata"), new Scope("email")))
                    .build();
            Identity.getAuthorizationClient(getActivity()).authorize(request)
                    .addOnSuccessListener(result -> {
                        if (result.hasResolution()) {
                            if (!interactive) { reply(call, "consent", null); return; }
                            try {
                                getBridge().saveCall(call);
                                driveCall = call;
                                getActivity().startIntentSenderForResult(result.getPendingIntent().getIntentSender(), RC_DRIVE, null, 0, 0, 0);
                            } catch (IntentSender.SendIntentException e) {
                                driveCall = null;
                                reply(call, "cancelled", null);
                            }
                        } else {
                            reply(call, result.getAccessToken() == null ? "cancelled" : null, result.getAccessToken());
                        }
                    })
                    .addOnFailureListener(e -> reply(call, errorCode(e), null));
        } catch (Exception e) {
            reply(call, errorCode(e), null);
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != RC_DRIVE || driveCall == null) return;
        PluginCall call = driveCall;
        driveCall = null;
        if (resultCode != Activity.RESULT_OK || data == null) { reply(call, "cancelled", null); return; }
        try {
            AuthorizationResult r = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data);
            reply(call, r.getAccessToken() == null ? "cancelled" : null, r.getAccessToken());
        } catch (ApiException e) {
            reply(call, errorCode(e), null);
        }
    }
}
