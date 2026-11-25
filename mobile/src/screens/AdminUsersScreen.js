import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Modal, ScrollView, FlatList, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
export default function AdminUsersScreen({
  navigation
}) {
  const [data, setData] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState('ALUNO');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  function openForm(item = null) {
    setEditing(item);
    setNome(item?.nome || "");
    setEmail(item?.email || "");
    setSenha("");
    setPerfil(item?.perfil || "ALUNO");
    setModal(true);
  }
  const [codigoCriado, setCodigoCriado] = useState('');
  async function criarUsuario() {
    if (nome.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !editing && !senha || senha && (senha.length < 8 || senha.length > 128) || nome.trim().length > 200 || email.trim().length > 200) return Alert.alert('Cadastro', 'Informe nome, e-mail válido e senha de 8 a 128 caracteres quando necessária.');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/usuarios/${editing.id}`, {
          nome: nome.trim(),
          email: email.trim(),
          perfil,
          ativo: !!editing.ativo,
          ...(senha ? {
            senha
          } : {})
        });
        setModal(false);
        setEditing(null);
        setSenha('');
        await load(busca);
        Alert.alert('Sucesso', 'Usuário atualizado.');
        return;
      }
      const {
        data: created
      } = await api.post('/admin/usuarios', {
        nome: nome.trim(),
        email: email.trim(),
        senha,
        perfil
      });
      setModal(false);
      setNome('');
      setEmail('');
      setSenha('');
      setPerfil('ALUNO');
      await load(busca);
      if (created.codigoRecuperacao) setCodigoCriado(created.codigoRecuperacao);else Alert.alert('Sucesso', 'Usuário cadastrado. Entregue a senha temporária de forma segura. O usuário deverá trocá-la e receberá seu código pessoal no primeiro acesso.');
    } catch (error) {
      Alert.alert('Cadastro', error.response?.data?.message || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  }
  async function load(term = '') {
    setLoading(true);
    try {
      const response = await api.get('/admin/usuarios', {
        params: {
          busca: term
        }
      });
      setData(response.data);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }
  useFocusEffect(useCallback(() => {
    load(busca);
  }, []));
  async function toggle(item, value) {
    if (busyId !== null) return;
    setBusyId(item.id);
    try {
      await api.put(`/admin/usuarios/${item.id}/status`, {
        ativo: value
      });
      setData(currentData => currentData.map(user => user.id === item.id ? {
        ...user,
        ativo: value
      } : user));
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha ao atualizar.');
    } finally {
      setBusyId(null);
    }
  }
  function excluir(item) {
    Alert.alert('Excluir usuário', `Excluir ${item.nome} permanentemente? Matrículas, progresso e outros dados associados podem ser removidos.`, [{
      text: 'Cancelar',
      style: 'cancel'
    }, {
      text: 'Excluir',
      style: 'destructive',
      onPress: async () => {
        if (busyId !== null) return;
        setBusyId(item.id);
        try {
          await api.delete(`/admin/usuarios/${item.id}`);
          await load(busca);
        } catch (error) {
          Alert.alert('Erro', error.response?.data?.message || 'Falha ao excluir usuário.');
        } finally {
          setBusyId(null);
        }
      }
    }]);
  }
  return <View style={styles.container}>
      <Text style={styles.title}>
        Usuários
      </Text>

      <Pressable style={styles.addButton} onPress={() => openForm()}><Text style={styles.addText}>+ Criar usuário</Text></Pressable>
      <Modal visible={!!codigoCriado} animationType="slide" onRequestClose={() => setCodigoCriado('')}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Usuário cadastrado</Text>
          <Text style={{
          marginVertical: 20
        }}>Entregue este código ao usuário de forma segura. Ele não poderá ser consultado depois.</Text>
          <Text selectable style={{
          fontSize: 23,
          fontWeight: '700'
        }}>{codigoCriado}</Text>
          <Pressable style={styles.addButton} onPress={() => setCodigoCriado('')}><Text style={styles.addText}>Concluir</Text></Pressable>
        </View>
      </Modal>
      <Modal visible={modal} animationType="slide" onRequestClose={() => {
      if (!saving) setModal(false);
    }}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{editing ? 'Editar usuário' : 'Novo usuário'}</Text>
          <TextInput style={styles.search} placeholder="Nome completo" value={nome} onChangeText={setNome} />
          <TextInput style={styles.search} placeholder="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.search} placeholder={editing ? 'Nova senha (opcional)' : 'Senha provisória (mínimo 8 caracteres)'} value={senha} onChangeText={setSenha} secureTextEntry />
          <Text style={styles.roleLabel}>Perfil</Text>
          <View style={styles.roles}>{['ALUNO', 'PROFESSOR', 'ADMIN'].map(value => <Pressable key={value} style={[styles.roleButton, perfil === value && styles.selectedRole]} onPress={() => setPerfil(value)}>
              <Text style={perfil === value ? styles.selectedText : styles.roleText}>{value}</Text>
            </Pressable>)}</View>
          <Pressable style={styles.addButton} onPress={criarUsuario} disabled={saving}><Text style={styles.addText}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}</Text></Pressable>
          <Pressable disabled={saving} onPress={() => setModal(false)}><Text style={styles.cancel}>Cancelar</Text></Pressable>
        </ScrollView>
      </Modal>
      <TextInput style={styles.search} placeholder="Buscar nome ou email" value={busca} onChangeText={setBusca} onSubmitEditing={() => load(busca)} />

      <FlatList data={data} keyExtractor={item => String(item.id)} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(busca)} />} renderItem={({
      item
    }) => <View style={styles.card}>
            <View style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.name}>
                {item.nome}
              </Text>

              <Text style={styles.email}>
                {item.email}
              </Text>

              <Text style={styles.role}>
                {item.perfil}
              </Text>
            </View>

            <Switch disabled={busyId !== null} value={!!item.ativo} onValueChange={value => toggle(item, value)} />
            </View>
            <View style={styles.actions}>
              {item.perfil === "ALUNO" && <Pressable style={styles.action} onPress={() => navigation.navigate("AdminAlunoProgresso", {
          id: item.id,
          nome: item.nome
        })}><Text style={styles.editText}>Progresso</Text></Pressable>}
              <Pressable disabled={busyId !== null} style={styles.action} onPress={() => openForm(item)}><Text style={styles.editText}>Editar</Text></Pressable>
              <Pressable disabled={busyId !== null} style={styles.action} onPress={() => excluir(item)}><Text style={styles.deleteText}>Excluir</Text></Pressable>
            </View>
          </View>} />
    </View>;
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: '#f4f6f8'
  },
  modalContent: {
    padding: 22,
    paddingTop: 55
  },
  addButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12
  },
  addText: {
    color: '#fff',
    fontWeight: '700'
  },
  roles: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 12
  },
  roleButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center'
  },
  selectedRole: {
    backgroundColor: '#2563eb'
  },
  selectedText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11
  },
  roleText: {
    color: '#344054',
    fontSize: 11
  },
  roleLabel: {
    marginTop: 10,
    fontWeight: '700'
  },
  cancel: {
    textAlign: 'center',
    color: '#2563eb',
    padding: 20
  },
  title: {
    fontSize: 25,
    fontWeight: '800'
  },
  search: {
    backgroundColor: '#fff',
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginVertical: 15
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8
  },
  action: {
    flex: 1,
    padding: 10,
    alignItems: 'center'
  },
  editText: {
    color: '#2563eb',
    fontWeight: '700'
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '700'
  },
  userInfo: {
    flex: 1
  },
  name: {
    fontWeight: '800'
  },
  email: {
    color: '#667085',
    marginTop: 3
  },
  role: {
    fontSize: 11,
    color: '#2563eb',
    marginTop: 4
  }
});
