import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
export default function FirstAccessScreen() {
  const {
    completeFirstAccess,
    startSession,
    logout
  } = useAuth();
  const [temporary, setTemporary] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null);
  async function submit() {
    if (busy) return;
    if (!temporary || password.length < 8 || password.length > 128 || password === temporary || password !== confirm) return Alert.alert('Atenção', 'Informe a senha temporária e uma nova senha diferente, de 8 a 128 caracteres, com confirmação igual.');
    setBusy(true);
    try {
      setResult(await completeFirstAccess(temporary, password));
      setTemporary('');
      setPassword('');
      setConfirm('');
    } catch (e) {
      Alert.alert('Primeiro acesso', e.response?.data?.message || e.message || 'Falha ao trocar senha.');
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    try {
      await startSession(result);
    } catch (e) {
      Alert.alert('Sessão', 'Não foi possível iniciar a sessão. Guarde o código e volte ao login.');
    } finally {
      setBusy(false);
    }
  }
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
 <Text style={styles.title}>{result ? 'Guarde seu código de recuperação' : 'Defina sua senha definitiva'}</Text>
 {result ? <><Text>Este código é pessoal. Guarde-o em local seguro antes de continuar.</Text><Text selectable style={styles.code}>{result.codigoRecuperacao}</Text><Pressable disabled={busy} style={styles.button} onPress={finish}><Text style={styles.white}>Guardei o código — continuar</Text></Pressable></> : <><Text>Por segurança, troque a senha temporária antes de acessar a plataforma.</Text>{[[temporary, setTemporary, 'Senha temporária'], [password, setPassword, 'Nova senha'], [confirm, setConfirm, 'Confirme a nova senha']].map(([value, setter, label]) => <TextInput key={label} style={styles.input} placeholder={label} value={value} onChangeText={setter} secureTextEntry autoCapitalize="none" editable={!busy} />)}<Pressable disabled={busy} style={styles.button} onPress={submit}><Text style={styles.white}>{busy ? 'Salvando...' : 'Alterar senha'}</Text></Pressable></>}
 <Pressable disabled={busy} onPress={logout}><Text style={styles.link}>Voltar ao login</Text></Pressable></ScrollView>;
}
const styles = StyleSheet.create({
  page: {
    padding: 22,
    backgroundColor: '#f4f6f8',
    flexGrow: 1,
    gap: 14
  },
  title: {
    fontSize: 24,
    fontWeight: '800'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10
  },
  white: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700'
  },
  code: {
    fontSize: 23,
    fontWeight: '800',
    padding: 15,
    backgroundColor: '#fff'
  },
  link: {
    color: '#2563eb',
    textAlign: 'center',
    padding: 12
  }
});
