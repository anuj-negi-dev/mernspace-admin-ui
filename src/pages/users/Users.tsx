import {
  Breadcrumb,
  Button,
  Drawer,
  Flex,
  Spin,
  Table,
  Space,
  theme,
  Form,
  Typography,
} from "antd";
import { RightOutlined, PlusOutlined } from "@ant-design/icons";
import { Link, Navigate } from "react-router-dom";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createUser, getUsers, updateUser } from "../../http/api";
import type { createUserData, FieldData, User } from "../../types";
import { useAuthStore } from "../../store";
import UsersFilter from "./UsersFilter";
import { useEffect, useMemo, useState } from "react";
import UserForm from "./forms/UserForm";
import { CURRENT_PAGE, PER_PAGE } from "../../constant";
import { debounce } from "lodash";

const columns = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
  },
  {
    title: "Name",
    dataIndex: "firstname",
    key: "firstname",
    render: (_text: string, record: User) => {
      return (
        <div>
          {record.firstname} {record.lastname}
        </div>
      );
    },
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
  },
  {
    title: "Email",
    dataIndex: "email",
    key: "email",
  },
  {
    title: "Restaurant",
    dataIndex: "tenant",
    key: "tenant",
    render: (_text: string, record: User) => {
      return <div>{record.tenant?.name}</div>;
    },
  },
];

function Users() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const {
    token: { colorBgLayout },
  } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [queryParams, setQueryParam] = useState({
    currentPage: CURRENT_PAGE,
    perPage: PER_PAGE,
  });
  const {
    data: users,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["users", queryParams],
    queryFn: () => {
      const filteredParams = Object.fromEntries(
        Object.entries(queryParams).filter((item) => !!item[1])
      );
      const queryString = new URLSearchParams(
        filteredParams as unknown as Record<string, string>
      ).toString();
      return getUsers(queryString).then((res) => res.data);
    },
    placeholderData: keepPreviousData,
  });

  const { user } = useAuthStore();

  const { mutate: userMutate } = useMutation({
    mutationKey: ["user"],
    mutationFn: (data: createUserData) =>
      createUser(data).then((res) => res.data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const { mutate: updateUserMutate } = useMutation({
    mutationKey: ["update-user"],
    mutationFn: (data: createUserData) =>
      updateUser(data, currentUser!.id).then((res) => res.data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  
  const onHandleSubmit = async () => {
    await form.validateFields()
    const isEditMode = !!currentUser
    if(isEditMode){
      await updateUserMutate(form.getFieldsValue())
    } else {
      await userMutate(form.getFieldsValue());
    }
    setCurrentUser(null)
    setDrawerOpen(false);
    form.resetFields();
  };

  const debouncedQUpdate = useMemo(() => {
    return debounce((value: string | undefined) => {
      setQueryParam((prev) => ({ ...prev, q: value, currentPage: 1 }));
    }, 1000);
  }, []);

  const onFilterChange = (changedFields: FieldData[]) => {
    const changedFilterFields = changedFields
      .map((item) => ({
        [item.name[0]]: item.value,
      }))
      .reduce((acc, item) => ({ ...acc, ...item }), {});

    if ("q" in changedFilterFields) {
      debouncedQUpdate(changedFilterFields.q);
    } else {
      setQueryParam((prev) => ({
        ...prev,
        ...changedFilterFields,
        currentPage: 1,
      }));
    }
  };

  useEffect(() => {
    if(currentUser){
      setDrawerOpen(true)
      form.setFieldsValue({...currentUser, tenantId: currentUser.tenant?.id})
    }
  }, [currentUser, form])

  if (user?.role !== "admin") {
    return <Navigate to="/" replace={true} />;
  }

  return (
    <>
      <Flex justify="space-between">
        <Breadcrumb
          separator={<RightOutlined />}
          items={[
            {
              title: <Link to="/">Dashboard</Link>,
            },
            {
              title: "Users",
            },
          ]}
        />
        {isFetching && <Spin size="small" />}
        {isError && (
          <Typography.Text strong type="danger">
            {error.message}
          </Typography.Text>
        )}
      </Flex>
      <Form form={filterForm} onFieldsChange={onFilterChange}>
        <UsersFilter>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setDrawerOpen(true)
              setCurrentUser(null)
            }}
          >
            Create User
          </Button>
        </UsersFilter>
      </Form>

      <Table
        columns={[
          ...columns,
          {
            title: "Actions",
            render: (_text: string, record: User) => {
              return (
                <Space>
                  <Button
                    type="link"
                    onClick={() => {
                      setCurrentUser(record);
                    }}
                  >
                    Edit
                  </Button>
                </Space>
              );
            },
          },
        ]}
        dataSource={users?.data}
        rowKey={"id"}
        style={{ marginTop: "16px" }}
        pagination={{
          total: users?.total,
          pageSize: queryParams.perPage,
          current: queryParams.currentPage,
          onChange: (page) => {
            setQueryParam((prev) => {
              return {
                ...prev,
                currentPage: page,
              };
            });
          },
          showTotal: (total: number, range: number[]) => {
            return (
              <Typography.Text strong>
                {`${range[0]}-${range[1]} of ${total}`}
              </Typography.Text>
            );
          },
        }}
      />

      <Drawer
        title={currentUser ? <h2>Edit User</h2> : <h2>Create a new user</h2>}
        width={720}
        destroyOnHidden
        closable
        onClose={() => {
          form.resetFields();
          setDrawerOpen(false);
        }}
        open={drawerOpen}
        extra={
          <Space>
            <Button
              onClick={() => {
                form.resetFields();
                setDrawerOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="primary" onClick={onHandleSubmit}>
              {currentUser ? `Save`: 'Submit'}
            </Button>
          </Space>
        }
        styles={{ body: { background: colorBgLayout } }}
      >
        <Form layout="vertical" form={form}>
          <UserForm isEditMode={!!currentUser}/>
        </Form>
      </Drawer>
    </>
  );
}

export default Users;
