import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import api from '../services/api';
export default function RecoverScreen({
  navigation
}) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  async function recuperar() {
    if (!email.trim() || !/^[A-Z2-9]{16}$/.test(codigo.toUpperCase().replace(/[-\s]/g, '')) || senha.length < 8 || senha !== confirmacao) return Alert.alert('Atenção', 'Informe e-mail, código válido e senhas iguais de pelo menos 8 caracteres.');
    setLoading(true);
    try {
      const response = await api.post('/auth/recover', {
        email: email.trim(),
        codigoRecuperacao: codigo,
        novaSenha: senha
      });
      if (response.data.codigoRecuperacao) setNovoCodigo(response.data.codigoRecuperacao);else Alert.alert('Senha redefinida', 'A API não retornou o novo código. Procure o administrador.', [{
        text: 'OK',
        onPress: () => navigation.goBack()
      }]);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha ao conectar.');
    } finally {
      setLoading(false);
    }
  }
  if (novoCodigo) return <View style={styles.container}>
    <Text style={styles.title}>Senha redefinida</Text>
    <Text style={styles.help}>O código anterior foi invalidado. Guarde o novo código:</Text>
    <Text selectable style={[styles.title, {
      fontSize: 22,
      marginBottom: 24
    }]}>{novoCodigo}</Text>
    <Pressable style={styles.button} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Já guardei o código</Text></Pressable>
  </View>;
  return <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        Recuperar senha
      </Text>

      <Text style={styles.help}>
        Informe o e-mail cadastrado, o código de recuperação e a nova senha.
      </Text>

      <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

      <TextInput style={styles.input} placeholder="Código de recuperação" value={codigo} onChangeText={setCodigo} autoCapitalize="characters" autoCorrect={false} />
      <View style={styles.passwordContainer}>
        <TextInput style={styles.passwordInput} placeholder="Nova senha" secureTextEntry={!mostrarSenha} value={senha} onChangeText={setSenha} />

        {senha.length > 0 && <Pressable onPress={() => setMostrarSenha(!mostrarSenha)}>
            <Text style={styles.showPassword}>
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </Text>
          </Pressable>}
      </View>

      <TextInput style={styles.input} placeholder="Confirmar nova senha" value={confirmacao} onChangeText={setConfirmacao} secureTextEntry={!mostrarSenha} maxLength={128} />
      <Pressable disabled={loading} style={styles.button} onPress={recuperar}>
        <Text style={styles.buttonText}>
          {loading ? 'Redefinindo...' : 'Redefinir senha'}
        </Text>
      </Pressable>
    </ScrollView>;
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f4f6f8'
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 30
  },
  help: {
    color: '#667085',
    marginVertical: 18
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12
  },
  passwordContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  passwordInput: {
    flex: 1,
    padding: 14
  },
  showPassword: {
    color: '#2563eb',
    fontWeight: '600',
    paddingHorizontal: 14
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700'
  }
});
