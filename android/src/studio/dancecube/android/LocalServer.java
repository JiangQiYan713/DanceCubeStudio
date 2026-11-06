package studio.dancecube.android;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import android.content.res.AssetManager;

final class LocalServer {
 final File root;final ServerSocket server;final AssetManager assets;
 final ExecutorService pool=Executors.newFixedThreadPool(4);volatile boolean closed;
 LocalServer(File root,int port,AssetManager assets)throws IOException{this.root=root.getCanonicalFile();this.assets=assets;server=new ServerSocket();server.setReuseAddress(true);server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),port));}
 void start(){Thread t=new Thread(()->{while(!closed)try{final Socket s=server.accept();pool.execute(()->serve(s));}catch(Exception e){if(!closed)close();}},"DanceCube-local");t.setDaemon(true);t.start();}
 void close(){closed=true;try{server.close();}catch(Exception ignored){}pool.shutdownNow();}
 static String line(InputStream in)throws IOException{ByteArrayOutputStream b=new ByteArrayOutputStream();int c;while((c=in.read())!=-1){if(c==10)break;if(b.size()>=8192)throw new IOException("header");if(c!=13)b.write(c);}return b.toString("US-ASCII");}
 static String mime(String name){String s=name.toLowerCase(Locale.ROOT);if(s.endsWith(".js"))return "text/javascript; charset=utf-8";if(s.endsWith(".html"))return "text/html; charset=utf-8";if(s.endsWith(".css"))return "text/css; charset=utf-8";if(s.endsWith(".json"))return "application/json";if(s.endsWith(".svg"))return "image/svg+xml";if(s.endsWith(".png"))return "image/png";if(s.endsWith(".jpg")||s.endsWith(".jpeg"))return "image/jpeg";if(s.endsWith(".ogg"))return "audio/ogg";if(s.endsWith(".mp3"))return "audio/mpeg";if(s.endsWith(".wav"))return "audio/wav";if(s.endsWith(".m4a"))return "audio/mp4";if(s.endsWith(".woff2"))return "font/woff2";return "application/octet-stream";}
 static byte[] read(InputStream in)throws IOException{try{ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] data=new byte[16384];int n;while((n=in.read(data))!=-1)b.write(data,0,n);return b.toByteArray();}finally{in.close();}}
 void serve(Socket socket){try(Socket s=socket){s.setSoTimeout(10000);InputStream in=s.getInputStream();OutputStream out=s.getOutputStream();String[] first=line(in).split(" ");if(first.length<2)return;
  Map<String,String> headers=new HashMap<>();for(int i=0;i<80;i++){String h=line(in);if(h.isEmpty())break;int colon=h.indexOf(':');if(colon>0)headers.put(h.substring(0,colon).toLowerCase(Locale.ROOT),h.substring(colon+1).trim());}
  String host=headers.get("host");if(!("127.0.0.1:18964".equals(host)))return;
  boolean head=first[0].equals("HEAD");if(!head&&!first[0].equals("GET"))return;
  String path=URLDecoder.decode(first[1].split("\\?",2)[0].replace("+","%2B"),"UTF-8");if(path.equals("/"))path="/index.html";
  File f=new File(root,path.substring(1)).getCanonicalFile();if(!f.getPath().startsWith(root.getPath()+File.separator)){return;}
  byte[] bytes=null;String type=mime(path);String code="200 OK";String extra="";long start=0,length;
  if(path.equals("/__android.js")){bytes=read(assets.open("android.js"));type="text/javascript; charset=utf-8";}
  else if(!f.isFile()){code="404 Not Found";bytes="Not found".getBytes("UTF-8");}
  else if(path.equals("/index.html")||path.equals("/project.js")||path.equals("/settings-core.js")){
   String text=new String(read(new FileInputStream(f)),"UTF-8");
   if(path.equals("/index.html"))text=text.replace("<head>","<head><script src=\"/__android.js\"></script>");
   if(path.equals("/project.js"))text=text.replace("targetFps:120","targetFps:60").replace("spectrum:true","spectrum:false").replace("deviceMode:'auto'","deviceMode:'tablet'");
   if(path.equals("/settings-core.js"))text=text.replace("background:{enabled:true","background:{enabled:false");
   bytes=text.getBytes("UTF-8");
  }
  length=bytes!=null?bytes.length:f.length();long full=length;
  String range=headers.get("range");if(range!=null&&bytes==null){try{if(!range.matches("bytes=[0-9]*-[0-9]*"))throw new Exception();String[] r=range.substring(6).split("-",-1);long end=length-1;if(r[0].isEmpty()){start=Math.max(0,length-Long.parseLong(r[1]));}else{start=Long.parseLong(r[0]);if(!r[1].isEmpty())end=Math.min(end,Long.parseLong(r[1]));}if(start<0||start>=full||end<start)throw new Exception();length=end-start+1;code="206 Partial Content";extra="Content-Range: bytes "+start+"-"+end+"/"+full+"\r\n";}catch(Exception e){code="416 Range Not Satisfiable";extra="Content-Range: bytes */"+full+"\r\n";length=0;}}
  out.write(("HTTP/1.1 "+code+"\r\nContent-Type: "+type+"\r\nContent-Length: "+length+"\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n"+extra+"\r\n").getBytes("US-ASCII"));
  if(!head&&length>0){if(bytes!=null)out.write(bytes);else try(RandomAccessFile file=new RandomAccessFile(f,"r")){file.seek(start);byte[] buf=new byte[65536];while(length>0){int n=file.read(buf,0,(int)Math.min(length,buf.length));if(n<0)break;out.write(buf,0,n);length-=n;}}}out.flush();
 }catch(Exception ignored){}}
}
