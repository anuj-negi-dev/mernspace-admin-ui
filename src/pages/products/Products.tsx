import {
  Flex,
  Breadcrumb,
  Form,
  Button,
  Table,
  Typography,
  Space,
  Image,
  Tag,
  Spin,
  Drawer,
  theme,
} from "antd";
import { RightOutlined, PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ProductFilter from "./ProductFilter";
import type { FieldData, Product } from "../../types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createProduct, getProducts, updateProduct } from "../../http/api";
import { useEffect, useMemo, useState } from "react";
import { CURRENT_PAGE, PER_PAGE } from "../../constant";
import { format } from "date-fns";
import { debounce } from "lodash";
import { useAuthStore } from "../../store";
import ProductForm from "./forms/ProductForm";
import { makeFormData } from "./helper";

const columns = [
  {
    title: "Product Name",
    dataIndex: "name",
    key: "name",
    render: (_text: string, record: Product) => {
      return (
        <div>
          <Space>
            <Image width={60} src={record.image} preview={false} />
            <Typography.Text>{record.name}</Typography.Text>
          </Space>
        </div>
      );
    },
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
  },
  {
    title: "Status",
    dataIndex: "isPublish",
    key: "isPublish",
    render: (_: boolean, record: Product) => {
      return (
        <>
          {record.isPublish ? (
            <Tag color="green">Published</Tag>
          ) : (
            <Tag color="red">Draft</Tag>
          )}
        </>
      );
    },
  },
  {
    title: "CreatedAt",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (text: string) => {
      return (
        <Typography.Text>
          {format(new Date(text), "dd/MM/yyyy HH:mm a")}
        </Typography.Text>
      );
    },
  },
];

function Products() {
  const queryClient = useQueryClient();
  const [filterForm] = Form.useForm();
  const [selectedProduct , setSelectedProduct] = useState<Product | null>(null)
  const [form] = Form.useForm();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    token: { colorBgLayout },
  } = theme.useToken();

  const { user } = useAuthStore();

  const [queryParams, setQueryParams] = useState({
    currentPage: CURRENT_PAGE,
    perPage: PER_PAGE,
    tenantId: user!.role === "manager" ? user?.tenant?.id : undefined,
  });

  const debouncedQUpdate = useMemo(() => {
    return debounce((value: string | undefined) => {
      setQueryParams((prev) => ({
        ...prev,
        q: value,
        currentPage: 1,
      }));
    }, 1000);
  }, []);

  const onFilterChange = (changedFields: FieldData[]) => {
    const changedFilterFields = changedFields
      .map((item) => ({ [item.name[0]]: item.value }))
      .reduce((acc, item) => ({ ...acc, ...item }), {});

    if ("q" in changedFilterFields) {
      debouncedQUpdate(changedFilterFields.q);
    } else {
      setQueryParams((prev) => ({
        ...prev,
        ...changedFilterFields,
        currentPage: 1,
      }));
    }
  };

  const {
    data: products,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["products", queryParams],
    queryFn: async () => {
      const filteredParams = Object.fromEntries(
        Object.entries(queryParams).filter((item) => !!item[1])
      );
      const queryString = new URLSearchParams(
        filteredParams as unknown as Record<string, string>
      ).toString();
      return getProducts(queryString).then((res) => res.data);
    },
    placeholderData: keepPreviousData,
  });

  const { mutate: productMutate, isPending: isCreateLoading } = useMutation({
    mutationKey: ["product"],
    mutationFn: async (data: FormData) => {
      if(!selectedProduct){
        return createProduct(data).then((res) => res.data);
      } else {
        return updateProduct(data, selectedProduct._id).then((res) => res.data)
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["products"],
      });
      form.resetFields();
      setDrawerOpen(false);
      return;
    },
  });

  const onHandleSubmit = async () => {
    await form.validateFields();
    const priceConfiguration = form.getFieldValue("priceConfiguration");
    const pricing = Object.entries(priceConfiguration).reduce(
      (acc, [key, value]) => {
        const parsedKey = JSON.parse(key);

        return {
          ...acc,
          [parsedKey.configurationKey]: {
            priceType: parsedKey.priceType,
            availableOptions: value,
          },
        };
      },
      {}
    );
    const attributes = Object.entries(form.getFieldValue("attributes")).map(
      ([key, value]) => {
        return {
          name: key,
          value,
        };
      }
    );

    const postData = {
      ...form.getFieldsValue(),
      tenantId: form.getFieldValue("tenantId") || user?.tenant?.id,
      isPublish: form.getFieldValue("isPublish") || false,
      priceConfiguration: pricing,
      attributes,
    };

    const formData = makeFormData(postData);

    await productMutate(formData);
  };

  useEffect(() => {
    if(selectedProduct){
      setDrawerOpen(true)
      const priceConfiguration = Object.entries(selectedProduct.priceConfiguration).reduce((acc,  [key, value]) => {
        const stringifiedKey = JSON.stringify({
          configurationKey: key,
          priceType: value.priceType
        })
        return {
          ...acc,
          [stringifiedKey]: value.availableOptions
        }
      }, {})

      const attributes = selectedProduct.attributes.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name]: curr.value
        } 
      }, {})

      form.setFieldsValue({
        ...selectedProduct,
        priceConfiguration,
        attributes,
      })
    }
  }, [selectedProduct, form])

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
              title: "Products",
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
        <ProductFilter>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setDrawerOpen(true)
              setSelectedProduct(null)
            }}
          >
            Add Product
          </Button>
        </ProductFilter>
      </Form>

      <Table
        dataSource={products?.data}
        columns={[
          ...columns,
          {
            title: "Actions",
            render: (_text: string, record: Product) => {
              return (
                <Space>
                  <Button type="link" onClick={() => {
                    setSelectedProduct(record)
                  }}>
                    Edit
                  </Button>
                </Space>
              );
            },
          },
        ]}
        rowKey={"_id"}
        style={{ marginTop: "16px" }}
        pagination={{
          total: products?.total,
          pageSize: queryParams.perPage,
          current: queryParams.currentPage,
          onChange: (page) => {
            setQueryParams((prev) => {
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
        title={
          selectedProduct ? "Update product" : "Create a new Product"
        }
        width={720}
        destroyOnHidden
        closable
        styles={{ body: { background: colorBgLayout } }}
        open={drawerOpen}
        onClose={() => {
          setSelectedProduct(null)
          form.resetFields();
          setDrawerOpen(false);
        }}
        extra={
          <Space>
            <Button
              onClick={() => {
                setSelectedProduct(null)
                form.resetFields();
                setDrawerOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="primary" onClick={onHandleSubmit}loading={isCreateLoading}>
              Submit
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <ProductForm form={form}/>
        </Form>
      </Drawer>
    </>
  );
}

export default Products;
