import React, { useState } from "react";
import { SafeAreaView, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { apiCall } from "./src/services/api";
import { saveToken, clearToken } from "./src/services/session";

type OwnerSession = { token?: string; role?: string; name?: string; roleName?: string };

export default function App() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [owner, setOwner] = useState<OwnerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (!code.trim() || !pin.trim()) { setError("กรุณากรอกชื่อผู้ใช้และ PIN"); return; }
    setBusy(true); setError("");
    try {
      const result = await apiCall<OwnerSession>("login", { code: code.trim(), pin: pin.trim(), from: "Personal Native App" });
      if (!result.token || result.role !== "owner") {
        if (result.token) await apiCall("logout", { t: result.token }).catch(() => undefined);
        throw new Error("บัญชีนี้ไม่มีสิทธิ์ Owner หรือระบบต้องการการยืนยันตัวตนเพิ่มเติม");
      }
      await saveToken(result.token);
      setOwner(result);
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    try { if (owner?.token) await apiCall("logout", { t: owner.token }).catch(() => undefined); }
    finally { await clearToken(); setOwner(null); setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <View style={styles.brandMark}><Text style={styles.mark}>B</Text></View>
          <Text style={styles.eyebrow}>PERSONAL BUSINESS CONTROL</Text>
          <Text style={styles.title}>{owner ? "ยินดีต้อนรับ" : "Business Control"}</Text>
          <Text style={styles.subtitle}>{owner ? "เชื่อมต่อบัญชี Owner แล้ว" : "ศูนย์ควบคุมระบบธุรกิจส่วนตัว"}</Text>
          {owner ? (
            <View style={styles.panel}>
              <Text style={styles.label}>OWNER SESSION</Text>
              <Text style={styles.ownerName}>{owner.name || "Owner"}</Text>
              <Text style={styles.muted}>ระบบกำลังเตรียมเชื่อมต่อโมดูลธุรกิจ</Text>
              <Pressable style={styles.button} onPress={signOut} disabled={busy}>
                {busy ? <ActivityIndicator color="#08251A" /> : <Text style={styles.buttonText}>ออกจากระบบ</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.label}>OWNER SIGN IN</Text>
              <TextInput value={code} onChangeText={setCode} placeholder="ชื่อผู้ใช้" placeholderTextColor="#789187" autoCapitalize="none" style={styles.input} />
              <TextInput value={pin} onChangeText={setPin} placeholder="PIN" placeholderTextColor="#789187" secureTextEntry keyboardType="number-pad" style={styles.input} />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Pressable style={[styles.button, busy && styles.disabled]} onPress={signIn} disabled={busy}>
                {busy ? <ActivityIndicator color="#08251A" /> : <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>}
              </Pressable>
              <Text style={styles.note}>ใช้สิทธิ์ Owner และระบบยืนยันตัวตนเดิมของ CMS</Text>
            </View>
          )}
          <Text style={styles.footer}>PRIVATE APP • MULTI-DEVICE • SECURE SESSION</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#071A14"},flex:{flex:1},container:{flex:1,justifyContent:"center",padding:26},
  brandMark:{width:54,height:54,borderRadius:18,backgroundColor:"#B5F36B",alignItems:"center",justifyContent:"center",marginBottom:24},
  mark:{fontSize:30,fontWeight:"900",color:"#08251A"},eyebrow:{color:"#B5F36B",fontSize:11,fontWeight:"800",letterSpacing:2},
  title:{color:"#F5FFF8",fontSize:32,fontWeight:"800",marginTop:8},subtitle:{color:"#9CB6A9",fontSize:14,marginTop:7,marginBottom:30},
  panel:{backgroundColor:"#102B21",borderColor:"#244638",borderWidth:1,borderRadius:24,padding:22},
  label:{color:"#B5F36B",fontSize:11,fontWeight:"800",letterSpacing:1.5,marginBottom:18},
  input:{height:54,borderWidth:1,borderColor:"#315646",borderRadius:13,paddingHorizontal:15,color:"#F5FFF8",fontSize:16,marginBottom:12,backgroundColor:"#0B211A"},
  button:{height:54,borderRadius:14,backgroundColor:"#B5F36B",alignItems:"center",justifyContent:"center",marginTop:8},
  buttonText:{color:"#08251A",fontSize:15,fontWeight:"800"},disabled:{opacity:.6},error:{color:"#FF9B9B",fontSize:13,marginBottom:8},
  note:{color:"#789187",fontSize:11,textAlign:"center",marginTop:16},ownerName:{color:"#F5FFF8",fontSize:24,fontWeight:"800"},
  muted:{color:"#9CB6A9",fontSize:13,marginTop:7,marginBottom:18},footer:{color:"#587467",fontSize:9,textAlign:"center",letterSpacing:1.5,marginTop:32},
});
