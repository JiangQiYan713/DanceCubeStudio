package android.content.res;
import java.io.*;
public class AssetManager { public InputStream open(String path)throws IOException{return new FileInputStream("DanceCubeStudio/android/assets/"+path);} }
