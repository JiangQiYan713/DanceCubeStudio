package studio.dancecube.android;

import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import android.util.Base64;
import java.io.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    static final String ORIGIN="http://127.0.0.1:18964/";
    WebView web; TextView status; LocalServer server; View customView; WebChromeClient.CustomViewCallback customCallback;
    ExecutorService io=Executors.newSingleThreadExecutor();
    ValueCallback<Uri[]> chooser; File exportFile; OutputStream exportStream; String exportName; boolean busy;
    @Override public void onCreate(Bundle b){
        super.onCreate(b);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive(); status=new TextView(this);status.setTextSize(20);status.setPadding(32,32,32,32);setContentView(status);
        start(false);
    }
    void immersive(){getWindow().getDecorView().setSystemUiVisibility(5894);}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
    void progress(final String message){runOnUiThread(new Runnable(){public void run(){if(status!=null)status.setText(message);}});}
    void start(final boolean update){
        if(busy)return;busy=true;
        if(web!=null){web.evaluateJavascript("if(typeof pause==='function')pause();if(typeof flushSave==='function')flushSave();",null);web.setVisibility(View.GONE);setContentView(status);}
        io.execute(new Runnable(){public void run(){try{
            if(server!=null){server.close();server=null;}
            File root=SiteInstaller.prepare(MainActivity.this,update);
            server=new LocalServer(root,18964,getAssets());server.start();
            runOnUiThread(new Runnable(){public void run(){busy=false;openWeb();}});
        }catch(final Exception e){runOnUiThread(new Runnable(){public void run(){busy=false;progress("站点准备失败："+e.getMessage());new AlertDialog.Builder(MainActivity.this).setTitle("无法加载站点").setMessage("请检查 GitHub 网络访问。已有本地副本不会被删除。\n"+e.getMessage()).setPositiveButton("重试",(d,w)->start(update)).setNeutralButton("离线打开",(d,w)->start(false)).setNegativeButton("退出",(d,w)->finish()).show();}});}}});
    }
    void openWeb(){
        if(web!=null)web.destroy();web=new WebView(this);WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);s.setBuiltInZoomControls(false);s.setUserAgentString(s.getUserAgentString()+" DanceCubeAndroid/1.0.1");
        web.addJavascriptInterface(new ExportBridge(),"DCAndroid");
        web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,String url){if(url.startsWith(ORIGIN))return false;try{Uri u=Uri.parse(url);if("https".equals(u.getScheme())||"http".equals(u.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}});
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onShowCustomView(View view,CustomViewCallback callback){if(customView!=null){callback.onCustomViewHidden();return;}customView=view;customCallback=callback;setContentView(view);immersive();}
            @Override public void onHideCustomView(){if(customView==null)return;setContentView(web);customView=null;if(customCallback!=null)customCallback.onCustomViewHidden();customCallback=null;immersive();}
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){if(chooser!=null)chooser.onReceiveValue(null);chooser=cb;Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,p.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);try{startActivityForResult(i,10);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;}
            @Override public boolean onJsAlert(WebView v,String url,String message,final JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->r.confirm()).setOnCancelListener(d->r.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView v,String url,String message,final JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->r.confirm()).setNegativeButton("取消",(d,w)->r.cancel()).setOnCancelListener(d->r.cancel()).show();return true;}
        });
        setContentView(web);web.loadUrl(ORIGIN);immersive();
    }
    class ExportBridge {
        @JavascriptInterface public synchronized boolean begin(String name){try{if(exportFile!=null)return false;exportName=name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_");exportFile=File.createTempFile("export-",".bin",getCacheDir());exportStream=new FileOutputStream(exportFile);return true;}catch(Exception e){cleanup();return false;}}
        @JavascriptInterface public synchronized boolean chunk(String data){try{if(exportStream==null||data.length()>400000||exportFile.length()>512L*1024*1024)throw new IOException("导出文件过大");exportStream.write(Base64.decode(data,Base64.DEFAULT));return true;}catch(Exception e){cleanup();return false;}}
        @JavascriptInterface public synchronized void cancel(){cleanup();}
        @JavascriptInterface public synchronized void finish(){try{exportStream.close();exportStream=null;runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/octet-stream");i.putExtra(Intent.EXTRA_TITLE,exportName);try{startActivityForResult(i,11);}catch(Exception e){cleanup();toast("无法打开保存对话框");}});}catch(Exception e){cleanup();}}
    }
    synchronized void cleanup(){try{if(exportStream!=null)exportStream.close();}catch(Exception ignored){}exportStream=null;if(exportFile!=null)exportFile.delete();exportFile=null;}
    void toast(String s){runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_LONG).show());}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==10&&chooser!=null){Uri[] uris=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();uris=new Uri[n];for(int j=0;j<n;j++)uris[j]=data.getClipData().getItemAt(j).getUri();}else if(data.getData()!=null)uris=new Uri[]{data.getData()};}chooser.onReceiveValue(uris);chooser=null;}
        if(request==11){if(result==RESULT_OK&&data!=null&&data.getData()!=null){final Uri uri=data.getData();io.execute(()->{try{try(InputStream in=new FileInputStream(exportFile);OutputStream out=getContentResolver().openOutputStream(uri)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);}toast("导出完成");}catch(Exception e){toast("导出失败："+e.getMessage());}finally{cleanup();}});}else cleanup();}
    }
    @Override public void onBackPressed(){if(customView!=null){setContentView(web);customView=null;if(customCallback!=null)customCallback.onCustomViewHidden();customCallback=null;immersive();return;}if(busy)return;if(web!=null)web.evaluateJavascript("if(typeof pause==='function')pause();",null);new AlertDialog.Builder(this).setTitle("DanceCube Studio · Android 1.0.1 预览版").setItems(new String[]{"继续编辑","更新站点（请先导出备份）","退出"},(d,w)->{if(w==1)new AlertDialog.Builder(this).setMessage("更新会重新加载网页；未导出的修改请先保存。继续？").setPositiveButton("更新",(dd,ww)->start(true)).setNegativeButton("取消",null).show();if(w==2)finish();}).show();}
    @Override protected void onPause(){if(web!=null){web.evaluateJavascript("if(typeof pause==='function')pause();if(typeof flushSave==='function')flushSave();",null);web.onPause();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();immersive();}
    @Override protected void onDestroy(){if(server!=null)server.close();if(web!=null){web.removeJavascriptInterface("DCAndroid");web.destroy();}if(chooser!=null)chooser.onReceiveValue(null);io.shutdownNow();cleanup();super.onDestroy();}
}
