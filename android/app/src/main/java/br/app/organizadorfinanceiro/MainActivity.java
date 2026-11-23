package br.app.organizadorfinanceiro;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Casca Android do Organizador Financeiro.
 *
 * O site (index.html, css/, js/) é empacotado dentro do APK em assets/www e servido
 * pelo WebViewAssetLoader no endereço https://appassets.androidplatform.net/assets/www/.
 * Assim o app funciona 100% offline, o localStorage fica salvo no aparelho e os
 * módulos JavaScript carregam normalmente (o que não acontece com file://).
 */
public class MainActivity extends ComponentActivity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private static final String START_URL = ORIGIN + "/assets/www/index.html";

    private WebView webView;
    private View statusBarBg;
    private View navBarBg;
    private FrameLayout fullscreenContainer;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    private ValueCallback<Uri[]> filePathCallback;
    private String pendingFileContent;

    private ActivityResultLauncher<Intent> openFileLauncher;
    private ActivityResultLauncher<Intent> saveFileLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);

        registerLaunchers();
        buildLayout();
        setupWebView();
        setupBackButton();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    // ------------------------------------------------------------------ layout

    private void buildLayout() {
        int brand = getColor(R.color.brand);

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);

        // Faixas atrás da barra de status (topo amarelo) e da barra de navegação/teclado
        statusBarBg = new View(this);
        statusBarBg.setBackgroundColor(brand);
        navBarBg = new View(this);
        navBarBg.setBackgroundColor(getColor(R.color.surface));

        webView = new WebView(this);
        webView.setBackgroundColor(getColor(R.color.surface));

        column.addView(statusBarBg, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));
        column.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        column.addView(navBarBg, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));

        // Camada para vídeo em tela cheia
        fullscreenContainer = new FrameLayout(this);
        fullscreenContainer.setBackgroundColor(Color.BLACK);
        fullscreenContainer.setVisibility(View.GONE);

        FrameLayout root = new FrameLayout(this);
        root.addView(column, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(fullscreenContainer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Edge-to-edge: reservamos o espaço das barras do sistema e do teclado
        ViewCompat.setOnApplyWindowInsetsListener(column, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, 0, bars.right, 0);
            setHeight(statusBarBg, bars.top);
            setHeight(navBarBg, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        applyBarAppearance(false);
    }

    private static void setHeight(View v, int h) {
        ViewGroup.LayoutParams lp = v.getLayoutParams();
        if (lp.height != h) {
            lp.height = h;
            v.setLayoutParams(lp);
        }
    }

    /** Topo sempre amarelo (ícones escuros); rodapé acompanha o tema claro/escuro do app. */
    private void applyBarAppearance(boolean dark) {
        navBarBg.setBackgroundColor(getColor(dark ? R.color.surface_dark : R.color.surface));
        webView.setBackgroundColor(getColor(dark ? R.color.surface_dark : R.color.surface));
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setAppearanceLightStatusBars(true);
        c.setAppearanceLightNavigationBars(!dark);
    }

    // ------------------------------------------------------------------ WebView

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable); // chrome://inspect nas builds de debug

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // localStorage = onde os dados ficam salvos
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);     // links target=_blank caem no shouldOverrideUrlLoading
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);                     // o layout já é responsivo

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost()) || !request.isForMainFrame()) return false;
                openExternally(url); // links externos abrem fora do app
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            // <input type="file"> → "Restaurar backup"
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try {
                    openFileLauncher.launch(Intent.createChooser(intent, getString(R.string.choose_backup)));
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }

            // Vídeo em tela cheia
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) { callback.onCustomViewHidden(); return; }
                customView = view;
                customViewCallback = callback;
                fullscreenContainer.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                fullscreenContainer.setVisibility(View.VISIBLE);
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                c.hide(WindowInsetsCompat.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });

        // Ponte JS → Android. Só aceita mensagens da origem do próprio app
        // (iframes de terceiros, por exemplo, não conseguem usar).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "AndroidBridge", Collections.singleton(ORIGIN),
                    (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (isMainFrame && message.getData() != null) handleBridgeMessage(message.getData());
                    });
        }
    }

    private void handleBridgeMessage(String data) {
        try {
            JSONObject msg = new JSONObject(data);
            switch (msg.optString("type")) {
                case "theme":
                    applyBarAppearance(msg.optBoolean("dark"));
                    break;
                case "saveFile":
                    saveFile(msg.optString("name", "arquivo.txt"), msg.optString("content"), msg.optString("mime", "text/plain"));
                    break;
                case "print":
                    print(msg.optString("title", getString(R.string.app_name)));
                    break;
                default:
                    break;
            }
        } catch (Exception ignored) {
            // mensagem inválida: ignora
        }
    }

    // ------------------------------------------------------------------ arquivos

    private void registerLaunchers() {
        openFileLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (filePathCallback == null) return;
            filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
            filePathCallback = null;
        });

        saveFileLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            String content = pendingFileContent;
            pendingFileContent = null;
            if (result.getResultCode() != RESULT_OK || result.getData() == null || result.getData().getData() == null || content == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (out == null) throw new IllegalStateException();
                out.write(content.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, R.string.file_saved, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, R.string.file_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    /** Backup .json e CSV: o usuário escolhe onde salvar (Downloads, Drive…). */
    private void saveFile(String name, String content, String mime) {
        pendingFileContent = content;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            saveFileLauncher.launch(intent);
        } catch (ActivityNotFoundException e) {
            pendingFileContent = null;
            Toast.makeText(this, R.string.file_error, Toast.LENGTH_LONG).show();
        }
    }

    /** "Imprimir / PDF": usa o serviço de impressão do Android (inclui "Salvar como PDF"). */
    private void print(String title) {
        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
        if (pm == null) return;
        PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .build();
        pm.print(title, webView.createPrintDocumentAdapter(title), attrs);
    }

    private void openExternally(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show();
        }
    }

    // ------------------------------------------------------------------ voltar / ciclo de vida

    private void setupBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customView != null) { exitFullscreen(); return; }
                // Pergunta ao site se ele quer tratar o "voltar" (ex.: voltar para o Resumo)
                webView.evaluateJavascript("window.__androidBack ? window.__androidBack() : false", value -> {
                    if (!"true".equals(value)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });
    }

    private void exitFullscreen() {
        if (customView == null) return;
        fullscreenContainer.removeView(customView);
        fullscreenContainer.setVisibility(View.GONE);
        customView = null;
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).show(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        webView.destroy();
        super.onDestroy();
    }
}
