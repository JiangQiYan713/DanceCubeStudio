package studio.dancecube.android;
import java.io.*;import java.net.*;import java.nio.file.*;
public class ServerTest{
 static String request(String path,String extra)throws Exception{try(Socket s=new Socket("127.0.0.1",18964)){s.getOutputStream().write(("GET "+path+" HTTP/1.1\r\nHost: 127.0.0.1:18964\r\n"+extra+"\r\n").getBytes("US-ASCII"));return new String(LocalServer.read(s.getInputStream()),"UTF-8");}}
 static void check(boolean condition,String name){if(!condition)throw new AssertionError(name);System.out.println("PASS "+name);}
 public static void main(String[] args)throws Exception{LocalServer server=new LocalServer(new File("DanceCubeStudio/dist"),18964,new android.content.res.AssetManager());server.start();try{
 check(request("/","").contains("<script src=\"/__android.js\"></script>"),"early Android injection");
 check(request("/project.js","").contains("targetFps:60"),"60 FPS default");
 check(request("/settings-core.js","").contains("background:{enabled:false"),"no remote background default");
 check(request("/analysis-worker.js","").contains("text/javascript"),"worker JavaScript MIME");
 check(request("/assets/1738076956.ogg","Range: bytes=0-31\r\n").contains("206 Partial Content\r\n"),"audio range response");
 check(request("/assets/1738076956.ogg","Range: bytes=999999999-\r\n").contains("416 Range Not Satisfiable"),"invalid range");
 check(request("/%2e%2e/README.md","").isEmpty(),"directory traversal blocked");
 check(request("/__android.js","").contains("DCAndroid.chunk"),"export bridge served");
 }finally{server.close();}}
}
