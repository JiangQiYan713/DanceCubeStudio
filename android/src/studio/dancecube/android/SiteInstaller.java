package studio.dancecube.android;
import java.io.*;
import java.net.*;
import java.util.zip.*;

final class SiteInstaller {
 static void remove(File f){if(f.isDirectory()){File[] list=f.listFiles();if(list!=null)for(File c:list)remove(c);}f.delete();}
 static File prepare(MainActivity app,boolean update)throws Exception{
  File base=app.getFilesDir(),live=new File(base,"site"),old=new File(base,"site-old"),stage=new File(base,"site-staging");
  if(!new File(live,"index.html").isFile()&&new File(old,"index.html").isFile()){remove(live);if(!old.renameTo(live))throw new IOException("无法恢复本地副本");}
  if(!update&&new File(live,"index.html").isFile())return live;
  remove(stage);if(!stage.mkdirs())throw new IOException("无法创建下载目录");
  app.progress("正在从 GitHub 下载站点…首次运行需要网络。\n下载完成后可离线使用；后续不会在播放时更新。");
  HttpURLConnection conn=(HttpURLConnection)new URL("https://api.github.com/repos/JiangQiYan713/DanceCubeStudio/zipball").openConnection();
  conn.setConnectTimeout(20000);conn.setReadTimeout(30000);conn.setRequestProperty("User-Agent","DanceCubeStudio-Android/1.0.0");
  long total=0;int count=0;long started=System.currentTimeMillis();
  try{if(conn.getResponseCode()!=200)throw new IOException("GitHub HTTP "+conn.getResponseCode()+"，请确认仓库已公开并上传 dist");
   try(ZipInputStream zip=new ZipInputStream(new BufferedInputStream(conn.getInputStream()))){ZipEntry e;byte[] buffer=new byte[65536];while((e=zip.getNextEntry())!=null){
    if(Thread.currentThread().isInterrupted())throw new IOException("已取消");
    if(++count>25000||System.currentTimeMillis()-started>300000)throw new IOException("下载超时或文件过多");
    String n=e.getName();int slash=n.indexOf('/');if(slash<0)continue;n=n.substring(slash+1);if(!n.startsWith("dist/"))continue;n=n.substring(5);if(n.isEmpty())continue;
    File out=new File(stage,n);if(!out.getCanonicalPath().startsWith(stage.getCanonicalPath()+File.separator))throw new IOException("非法压缩路径");
    if(e.isDirectory()){out.mkdirs();continue;}if(!out.getParentFile().isDirectory()&&!out.getParentFile().mkdirs())throw new IOException("无法创建目录");
    try(OutputStream file=new FileOutputStream(out)){int len;while((len=zip.read(buffer))!=-1){total+=len;if(total>512L*1024*1024||System.currentTimeMillis()-started>300000)throw new IOException("站点过大或下载超时");file.write(buffer,0,len);}}
    app.progress("正在下载站点："+(total/1048576)+" MB\n"+n);
   }}
   if(!new File(stage,"index.html").isFile()||!new File(stage,"app.js").isFile())throw new IOException("仓库根目录缺少完整的 dist/index.html 和 dist/app.js");
   remove(old);if(live.exists()&&!live.renameTo(old))throw new IOException("无法备份旧副本");
   if(!stage.renameTo(live)){old.renameTo(live);throw new IOException("无法保存站点");}remove(old);return live;
  }catch(Exception e){remove(stage);throw e;}finally{conn.disconnect();}
 }
}
